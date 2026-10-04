// swift-tools-version: 6.4
import PackageDescription

let package = Package(
  name: "NativeFixture", platforms: [.macOS(.v14)],
  products: [.library(name: "Calc", targets: ["Calc"])],
  targets: [.target(name: "Calc"), .testTarget(name: "CalcTests", dependencies: ["Calc"])])
