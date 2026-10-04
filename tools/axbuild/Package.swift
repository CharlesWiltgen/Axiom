// swift-tools-version: 6.4
import PackageDescription

let package = Package(
  name: "axbuild", platforms: [.macOS(.v14)],
  products: [
    .library(name: "AxBuildCore", targets: ["AxBuildCore"]),
    .executable(name: "axbuild", targets: ["axbuild"]),
  ],
  targets: [
    .target(
      name: "AxBuildCore", path: "Sources/AxBuildCore",
      exclude: [
        "Fixtures", "Domain.test.swift", "Invocation.test.swift", "LogReader.test.swift",
        "TestReaders.test.swift", "Report.test.swift", "Runner.test.swift",
      ],
      sources: [
        "Domain.swift", "Invocation.swift", "LogReader.swift", "TestReaders.swift", "Report.swift",
        "Runner.swift",
      ]),
    .testTarget(
      name: "AxBuildCoreTests", dependencies: ["AxBuildCore"], path: "Sources/AxBuildCore",
      exclude: [
        "Domain.swift", "Invocation.swift", "LogReader.swift", "TestReaders.swift", "Report.swift",
        "Runner.swift",
      ],
      sources: [
        "Domain.test.swift", "Invocation.test.swift", "LogReader.test.swift",
        "TestReaders.test.swift", "Report.test.swift", "Runner.test.swift",
      ],
      resources: [.copy("Fixtures")]),
    .executableTarget(name: "axbuild", dependencies: ["AxBuildCore"]),
  ], swiftLanguageModes: [.v6])
