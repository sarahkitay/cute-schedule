import Foundation

public struct ProyouWidgetSnapshot: Codable {
    public struct TaskItem: Codable, Identifiable {
        public let id: String
        public let text: String
        public let done: Bool
        public let hourKey: String
        public let category: String
    }

    public struct CurrentTaskInfo: Codable {
        public let id: String
        public let text: String
        public let hourKey: String
        public let category: String
        public let dayKey: String
    }

    public struct HabitItem: Codable, Identifiable {
        public let id: String
        public let label: String
        public let direction: String
        public let todayStatus: String?
    }

    public struct ActiveTimerInfo: Codable {
        public let label: String
        public let remainingSec: Int
        public let endsAtMs: Double?
        public let linkedTaskText: String?
    }

    public let updatedAt: String
    public let todayKey: String
    public let tasks: [TaskItem]
    public let habits: [HabitItem]
    public let activeTimer: ActiveTimerInfo?
    public let currentTask: CurrentTaskInfo?
    public let nextTask: CurrentTaskInfo?
    public let openTaskCount: Int?
    public let hasTasks: Bool?

    public static func placeholder() -> ProyouWidgetSnapshot {
        let current = CurrentTaskInfo(
            id: "2",
            text: "Deep work block",
            hourKey: "10:00",
            category: "Work",
            dayKey: "today"
        )
        return ProyouWidgetSnapshot(
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            todayKey: "today",
            tasks: [
                TaskItem(id: "1", text: "Morning routine", done: true, hourKey: "08:00", category: "Personal"),
                TaskItem(id: "2", text: "Deep work block", done: false, hourKey: "10:00", category: "Work"),
            ],
            habits: [
                HabitItem(id: "h1", label: "Water", direction: "build", todayStatus: nil),
                HabitItem(id: "h2", label: "Screen time", direction: "break", todayStatus: "no"),
            ],
            activeTimer: ActiveTimerInfo(
                label: "Focus",
                remainingSec: 18 * 60 + 42,
                endsAtMs: Date().addingTimeInterval(18 * 60 + 42).timeIntervalSince1970 * 1000,
                linkedTaskText: "Deep work block"
            ),
            currentTask: current,
            nextTask: nil,
            openTaskCount: 1,
            hasTasks: true
        )
    }
}

public enum ProyouWidgetStore {
    public static let appGroupId = "group.app.proyou.proyou"
    public static let snapshotKey = "widget_snapshot_v1"

    public static func saveSnapshotJSON(_ json: String) {
        UserDefaults(suiteName: appGroupId)?.set(json, forKey: snapshotKey)
    }

    public static func loadSnapshot() -> ProyouWidgetSnapshot? {
        guard let json = UserDefaults(suiteName: appGroupId)?.string(forKey: snapshotKey),
              let data = json.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(ProyouWidgetSnapshot.self, from: data)
    }
}
