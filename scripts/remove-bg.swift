// Removes the background from every robot image using Apple Vision's
// foreground-instance mask, crops to the subject, and normalizes all robots
// to the same visual height on a 1024x1024 transparent canvas.
//
// Usage: swift scripts/remove-bg.swift public/robots public/robots-cutout
//
// Originals in public/robots/ are NEVER modified — the card system keeps
// using them. The home scene uses the transparent cutouts.

import Foundation
import CoreImage
import Vision
import ImageIO

guard CommandLine.arguments.count >= 3 else {
    print("usage: swift remove-bg.swift <inDir> <outDir>")
    exit(1)
}

let inDir = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outDir = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

let OUT = 1024
let SUBJECT_H = Double(OUT) * 0.86
let ctx = CIContext(options: [.cacheIntermediates: false])

let files = ((try? FileManager.default.contentsOfDirectory(at: inDir, includingPropertiesForKeys: nil)) ?? [])
    .filter { $0.pathExtension.lowercased() == "png" }
    .sorted { $0.lastPathComponent.compare($1.lastPathComponent, options: .numeric) == .orderedAscending }

func maskBuffer(for image: CGImage) -> CVPixelBuffer? {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
        guard let obs = request.results?.first else { return nil }
        return try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
    } catch {
        return nil
    }
}

func boundingBox(of mask: CVPixelBuffer) -> CGRect? {
    CVPixelBufferLockBaseAddress(mask, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(mask) else { return nil }
    let w = CVPixelBufferGetWidth(mask)
    let h = CVPixelBufferGetHeight(mask)
    let stride = CVPixelBufferGetBytesPerRow(mask) / MemoryLayout<Float>.size
    let floats = base.assumingMemoryBound(to: Float.self)
    var minX = w, minY = h, maxX = 0, maxY = 0
    for y in 0..<h {
        for x in 0..<w {
            if floats[y * stride + x] > 0.5 {
                if x < minX { minX = x }
                if x > maxX { maxX = x }
                if y < minY { minY = y }
                if y > maxY { maxY = y }
            }
        }
    }
    guard maxX >= minX, maxY >= minY else { return nil }
    return CGRect(x: CGFloat(minX), y: CGFloat(minY), width: CGFloat(maxX - minX + 1), height: CGFloat(maxY - minY + 1))
}

var ok = 0
var suspicious: [String] = []
var failed: [String] = []

for url in files {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        failed.append("\(url.lastPathComponent) (decode)")
        continue
    }
    guard let mask = maskBuffer(for: cg) else {
        failed.append("\(url.lastPathComponent) (mask)")
        continue
    }
    guard var bb = boundingBox(of: mask) else {
        failed.append("\(url.lastPathComponent) (empty mask)")
        continue
    }

    let imageH = CGFloat(cg.height)
    // Vision bbox is top-left origin; CoreImage is bottom-left.
    let bbCG = CGRect(x: bb.minX, y: imageH - (bb.minY + bb.height), width: bb.width, height: bb.height)

    let original = CIImage(cgImage: cg)
    let maskImg = CIImage(cvPixelBuffer: mask)
    let eroded = maskImg.applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 2.0])
    let cutout = original
        .applyingFilter("CIBlendWithMask", parameters: [
            kCIInputMaskImageKey: eroded,
            kCIInputBackgroundImageKey: CIImage(color: .clear),
        ])
        .cropped(to: bbCG)

    let scale = min(SUBJECT_H / Double(bb.height), (Double(OUT) * 0.96) / Double(bb.width))
    let placed = cutout.transformed(by: CGAffineTransform(
        a: scale, b: 0, c: 0, d: scale,
        tx: (Double(OUT) - Double(bb.width) * scale) / 2 - scale * Double(bbCG.minX),
        ty: (Double(OUT) - Double(bb.height) * scale) / 2 - scale * Double(bbCG.minY)
    ))
    let canvas = CIImage(color: .clear).cropped(to: CGRect(x: 0, y: 0, width: OUT, height: OUT))
    let final = placed.composited(over: canvas)

    guard let outCG = ctx.createCGImage(final, from: CGRect(x: 0, y: 0, width: OUT, height: OUT)) else {
        failed.append("\(url.lastPathComponent) (render)")
        continue
    }
    let outURL = outDir.appendingPathComponent(url.lastPathComponent)
    guard let dest = CGImageDestinationCreateWithURL(outURL as CFURL, "public.png" as CFString, 1, nil) else {
        failed.append("\(url.lastPathComponent) (dest)")
        continue
    }
    CGImageDestinationAddImage(dest, outCG, nil)
    guard CGImageDestinationFinalize(dest) else {
        failed.append("\(url.lastPathComponent) (write)")
        continue
    }
    ok += 1
    let subjectPct = Int(Double(bb.height) / Double(cg.height) * 100)
    if subjectPct > 92 || subjectPct < 12 {
        suspicious.append("\(url.lastPathComponent) subject=\(subjectPct)%")
    }
}

print("processed: \(ok)/\(files.count)")
if !suspicious.isEmpty {
    print("SUSPICIOUS (check manually):")
    suspicious.forEach { print("  \($0)") }
}
if !failed.isEmpty {
    print("FAILED:")
    failed.forEach { print("  \($0)") }
}
