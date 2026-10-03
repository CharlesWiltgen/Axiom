// swift-tools-version: 6.4
import PackageDescription

let package = Package(
  name: "xcproject",
  platforms: [.macOS(.v14)],
  dependencies: [
    .package(
      url: "https://github.com/apple/xcode-project-format.git",
      revision: "296395785f7544f27ef929006b79af57e67092d3")
  ],
  targets: [
    .executableTarget(
      name: "xcproject",
      dependencies: [.product(name: "XcodeProjectFormat", package: "xcode-project-format")])
  ],
  swiftLanguageModes: [.v6]
)
