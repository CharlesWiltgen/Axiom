// swift-tools-version: 6.4
import PackageDescription

let package = Package(
  name: "axbuild", platforms: [.macOS(.v14)],
  products: [.library(name: "AxBuildCore", targets: ["AxBuildCore"])],
  targets: [
    .target(
      name: "AxBuildCore", path: "Sources/AxBuildCore",
      exclude: ["Fixtures", "Domain.test.swift", "Invocation.test.swift", "LogReader.test.swift"],
      sources: ["Domain.swift", "Invocation.swift", "LogReader.swift"]),
    .testTarget(
      name: "AxBuildCoreTests", dependencies: ["AxBuildCore"], path: "Sources/AxBuildCore",
      exclude: ["Domain.swift", "Invocation.swift", "LogReader.swift"],
      sources: ["Domain.test.swift", "Invocation.test.swift", "LogReader.test.swift"],
      resources: [.copy("Fixtures")]),
  ], swiftLanguageModes: [.v6])
