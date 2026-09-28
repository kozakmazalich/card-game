import CoreImage
import Foundation

for path in CommandLine.arguments.dropFirst() {
    guard let ci = CIImage(contentsOf: URL(fileURLWithPath: path)) else { print("\(path): unreadable"); continue }
    let ctx = CIContext()
    guard let img = ctx.createCGImage(ci, from: ci.extent) else { continue }
    let data = img.dataProvider!.data! as Data
    let px = [UInt8](data)
    var transparent = 0
    var total = 0
    var i = 3
    while i < px.count {
        if px[i] < 10 { transparent += 1 }
        total += 1
        i += 4
    }
    print("\(path): \(String(format: "%.1f", Double(transparent) / Double(total) * 100))% transparent")
}
