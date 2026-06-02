import WidgetKit
import SwiftUI

// MARK: - Timeline

struct ProyouWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: ProyouWidgetSnapshot
}

struct ProyouWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProyouWidgetEntry {
        ProyouWidgetEntry(date: Date(), snapshot: ProyouWidgetSnapshot.placeholder())
    }

    func getSnapshot(in context: Context, completion: @escaping (ProyouWidgetEntry) -> Void) {
        let snap = ProyouWidgetStore.loadSnapshot() ?? ProyouWidgetSnapshot.placeholder()
        completion(ProyouWidgetEntry(date: Date(), snapshot: snap))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProyouWidgetEntry>) -> Void) {
        let snap = ProyouWidgetStore.loadSnapshot() ?? ProyouWidgetSnapshot.placeholder()
        let entry = ProyouWidgetEntry(date: Date(), snapshot: snap)
        var next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        if let timer = snap.activeTimer, let endsMs = timer.endsAtMs {
            let ends = Date(timeIntervalSince1970: endsMs / 1000)
            if ends > Date() && ends < next {
                next = ends
            } else if timer.remainingSec > 0 && timer.remainingSec < 1800 {
                let soon = Date().addingTimeInterval(TimeInterval(min(timer.remainingSec, 60)))
                if soon < next { next = soon }
            }
        }
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Design tokens

private let widgetPink = Color(red: 0.91, green: 0.66, blue: 0.72)
private let widgetPinkDeep = Color(red: 0.82, green: 0.48, blue: 0.58)
private let widgetCream = Color(red: 1.0, green: 0.98, blue: 0.97)
private let widgetInk = Color(red: 0.18, green: 0.12, blue: 0.14)
private let widgetMuted = Color(red: 0.45, green: 0.38, blue: 0.40)

private var widgetBackground: some View {
    LinearGradient(
        colors: [widgetCream, Color(red: 0.99, green: 0.94, blue: 0.95)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

private func formatTimerRemaining(_ sec: Int) -> String {
    let s = max(0, sec)
    let m = s / 60
    let r = s % 60
    if m >= 60 {
        let h = m / 60
        let mm = m % 60
        return String(format: "%d:%02d:%02d", h, mm, r)
    }
    return String(format: "%d:%02d", m, r)
}

@ViewBuilder
private func widgetTimerBanner(_ timer: ProyouWidgetSnapshot.ActiveTimerInfo) -> some View {
    HStack(spacing: 8) {
        Image(systemName: "timer")
            .font(.caption.weight(.bold))
            .foregroundColor(.white)
        VStack(alignment: .leading, spacing: 1) {
            Text(formatTimerRemaining(timer.remainingSec))
                .font(.caption.weight(.heavy))
                .foregroundColor(.white)
            if let task = timer.linkedTaskText, !task.isEmpty {
                Text(task)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(.white.opacity(0.9))
                    .lineLimit(1)
            } else {
                Text(timer.label)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(.white.opacity(0.9))
                    .lineLimit(1)
            }
        }
        Spacer(minLength: 0)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 7)
    .background(
        LinearGradient(colors: [widgetPinkDeep, widgetPink], startPoint: .leading, endPoint: .trailing)
    )
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
}

@ViewBuilder
private func widgetHeader(title: String, badge: String?) -> some View {
    HStack(alignment: .firstTextBaseline) {
        Text(title)
            .font(.subheadline.weight(.heavy))
            .foregroundColor(widgetInk)
        Spacer(minLength: 0)
        if let badge, !badge.isEmpty {
            Text(badge)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(widgetPinkDeep)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(widgetPink.opacity(0.22))
                .clipShape(Capsule())
        }
    }
}

// MARK: - Views

struct ProyouTasksWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        let tasks = entry.snapshot.tasks
        let open = tasks.filter { !$0.done }
        VStack(alignment: .leading, spacing: 10) {
            if let timer = entry.snapshot.activeTimer, timer.remainingSec > 0 {
                widgetTimerBanner(timer)
            }
            widgetHeader(title: "Today ✨", badge: open.isEmpty ? nil : "\(open.count) left")
            if tasks.isEmpty {
                Text("No tasks yet, open PROYOU to plan your day.")
                    .font(.caption)
                    .foregroundColor(widgetMuted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(Array(tasks.prefix(5))) { task in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                            .font(.caption)
                            .foregroundColor(task.done ? widgetPink : widgetMuted.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(task.text)
                                .font(.caption.weight(task.done ? .regular : .medium))
                                .foregroundColor(task.done ? widgetMuted : widgetInk)
                                .strikethrough(task.done)
                                .lineLimit(1)
                            Text(task.hourKey)
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundColor(widgetMuted)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(widgetBackground)
    }
}

struct ProyouHabitsWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        let habits = entry.snapshot.habits
        VStack(alignment: .leading, spacing: 10) {
            if let timer = entry.snapshot.activeTimer, timer.remainingSec > 0 {
                widgetTimerBanner(timer)
            }
            widgetHeader(title: "Habits 🌿", badge: nil)
            if habits.isEmpty {
                Text("Add habits in PROYOU")
                    .font(.caption)
                    .foregroundColor(widgetMuted)
            } else {
                ForEach(Array(habits.prefix(4))) { habit in
                    HStack(spacing: 8) {
                        habitIcon(habit)
                        Text(habit.label)
                            .font(.caption.weight(.medium))
                            .foregroundColor(widgetInk)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 3)
                    .padding(.horizontal, 8)
                    .background(Color.white.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(widgetBackground)
    }

    @ViewBuilder
    private func habitIcon(_ habit: ProyouWidgetSnapshot.HabitItem) -> some View {
        let status = habit.todayStatus
        if status == "yes" {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(widgetPink)
                .font(.caption)
        } else if status == "no" {
            Image(systemName: "xmark.circle.fill")
                .foregroundColor(widgetMuted)
                .font(.caption)
        } else {
            Image(systemName: habit.direction == "break" ? "hand.raised.fill" : "leaf.fill")
                .foregroundColor(widgetPink.opacity(0.85))
                .font(.caption)
        }
    }
}

struct ProyouCombinedWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        let tasks = entry.snapshot.tasks.filter { !$0.done }
        let habits = entry.snapshot.habits
        VStack(alignment: .leading, spacing: 10) {
            if let timer = entry.snapshot.activeTimer, timer.remainingSec > 0 {
                widgetTimerBanner(timer)
            }
            widgetHeader(title: "PROYOU", badge: tasks.isEmpty ? nil : "\(tasks.count) tasks")
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Tasks")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(widgetMuted)
                    ForEach(Array(tasks.prefix(3))) { task in
                        Text(task.text)
                            .font(.caption)
                            .foregroundColor(widgetInk)
                            .lineLimit(1)
                    }
                    if tasks.isEmpty {
                        Text("All clear!")
                            .font(.caption)
                            .foregroundColor(widgetMuted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Habits")
                        .font(.caption2.weight(.bold))
                        .foregroundColor(widgetMuted)
                    ForEach(Array(habits.prefix(3))) { habit in
                        Text(habit.label)
                            .font(.caption)
                            .foregroundColor(widgetInk)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(widgetBackground)
    }
}

// MARK: - Widget definitions

struct ProyouTasksWidget: Widget {
    let kind = "ProyouTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProyouWidgetProvider()) { entry in
            ProyouTasksWidgetView(entry: entry)
                .widgetURL(URL(string: "proyou://today"))
        }
        .configurationDisplayName("Today's tasks")
        .description("See what's left on your schedule.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct ProyouHabitsWidget: Widget {
    let kind = "ProyouHabitsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProyouWidgetProvider()) { entry in
            ProyouHabitsWidgetView(entry: entry)
                .widgetURL(URL(string: "proyou://today"))
        }
        .configurationDisplayName("Habits")
        .description("Track today's habit check-ins.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct ProyouCombinedWidget: Widget {
    let kind = "ProyouCombinedWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProyouWidgetProvider()) { entry in
            ProyouCombinedWidgetView(entry: entry)
                .widgetURL(URL(string: "proyou://today"))
        }
        .configurationDisplayName("Tasks & habits")
        .description("Your day at a glance.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct ProyouWidgetBundle: WidgetBundle {
    var body: some Widget {
        ProyouTasksWidget()
        ProyouHabitsWidget()
        ProyouCombinedWidget()
    }
}
