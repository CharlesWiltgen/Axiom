// Test fixture for /audit-concurrency command
// This file contains common Swift 6 concurrency anti-patterns that should be detected

import UIKit
import SwiftUI
import Combine

// ANTI-PATTERN 1: Missing @MainActor on View/Observable classes
class MyViewController: UIViewController {
    var label: UILabel?

    func updateUI() {
        label?.text = "Updated"
    }
}

class MyObservableObject: ObservableObject {
    @Published var count = 0

    func increment() {
        count += 1
    }
}

// ANTI-PATTERN 2: Unsafe self capture in Task without [weak self]
class DataFetcher {
    var data: String = ""

    func fetchData() {
        Task {
            let result = await loadData()
            self.data = result  // ISSUE: Direct self capture without [weak self]
        }
    }

    func fetchWithMainActor() {
        Task {
            let result = await loadData()
            DispatchQueue.main.async {
                self.data = result  // ISSUE: Direct self capture
            }
        }
    }

    private func loadData() async -> String {
        return "data"
    }
}

// ANTI-PATTERN 3: Sendable violations
class NonSendableType {
    var value: String = ""
}

func processWithClosure(_ closure: @escaping (NonSendableType) -> Void) {
    Task { @MainActor in
        let data = NonSendableType()
        closure(data)  // ISSUE: Passing non-Sendable type across actor boundary
    }
}

// ANTI-PATTERN 4: Improper actor isolation
actor DataActor {
    var internalData: [String] = []

    func getData() -> [String] {
        return internalData
    }
}

class UIUpdater {
    let actor = DataActor()

    @MainActor
    func updateFromActor() async {
        let data = await actor.getData()
        // ISSUE: Using data from actor context without proper thread safety check
        let count = data.count
        print(count)
    }
}

// ANTI-PATTERN 5: Unsafe weak-strong pattern
class AsyncHandler {
    var callback: (() -> Void)?

    func setupAsync() {
        Task { [weak self] in
            // ISSUE: Checking weak self but then using self without guard
            if let self = self {
                // OK here
            }
            self?.callback?()  // ISSUE: self is used without optional checking context
        }
    }
}

// ANTI-PATTERN 6: Thread-confinement violation
class CoreDataManager {
    func fetchOnBackground() async -> [String] {
        let results = await Task.detached { [weak self] () -> [String] in
            // ISSUE: Accessing MainActor-isolated property from background context
            return self?.cachedResults ?? []
        }.value
        return results
    }

    @MainActor
    var cachedResults: [String] = []
}

// GOOD PATTERN: For comparison (should not trigger warnings)
@MainActor
class GoodViewController: UIViewController {
    var label: UILabel?

    func updateUI() {
        label?.text = "Updated"
    }
}

@MainActor
class GoodObservableObject: ObservableObject {
    @Published var count = 0

    func increment() {
        count += 1
    }
}

class GoodDataFetcher {
    var data: String = ""

    func fetchData() {
        Task { [weak self] in
            let result = await self?.loadData() ?? ""
            self?.data = result
        }
    }

    private func loadData() async -> String {
        return "data"
    }
}

struct SendableData: Sendable {
    let value: String
}

func goodProcessWithClosure(_ closure: @escaping (SendableData) -> Void) {
    Task { @MainActor in
        let data = SendableData(value: "test")
        closure(data)
    }
}
