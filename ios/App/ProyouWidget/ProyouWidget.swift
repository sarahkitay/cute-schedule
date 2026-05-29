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
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Views

private let widgetPink = Color(red: 0.91, green: 0.66, blue: 0.72)
private let widgetInk = Color(red: 0.18, green: 0.12, blue: 0.14)
private let widgetMuted = Color(red: 0.45, green: 0.38, blue: 0.40)

struct ProyouTasksWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        let tasks = entry.snapshot.tasks
        let open = tasks.filter { !$0.done }
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Today")
                    .font(.headline.weight(.bold))
                    .foregroundColor(widgetInk)
                Spacer()
                Text("\(open.count) left")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(widgetPink)
            }
            if tasks.isEmpty {
                Text("No tasks yet. Open PROYOU to plan your day.")
                    .font(.caption)
                    .foregroundColor(widgetMuted)
            } else {
                ForEach(Array(tasks.prefix(5))) { task in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                            .font(.caption)
                            .foregroundColor(task.done ? widgetPink : widgetMuted)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(task.text)
                                .font(.caption)
                                .foregroundColor(task.done ? widgetMuted : widgetInk)
                                .strikethrough(task.done)
                                .lineLimit(1)
                            Text(task.hourKey)
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(widgetMuted)
                        }
                    }
                }
            }
        }
        .padding(14)
    }
}

struct ProyouHabitsWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        let habits = entry.snapshot.habits
        VStack(alignment: .leading, spacing: 8) {
            Text("Habits")
                .font(.headline.weight(.bold))
                .foregroundColor(widgetInk)
            if habits.isEmpty {
                Text("Add habits in PROYOU")
                    .font(.caption)
                    .foregroundColor(widgetMuted)
            } else {
                ForEach(Array(habits.prefix(4))) { habit in
                    HStack(spacing: 6) {
                        habitIcon(habit)
                        Text(habit.label)
                            .font(.caption)
                            .foregroundColor(widgetInk)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .padding(14)
    }

    @ViewBuilder
    private func habitIcon(_ habit: ProyouWidgetSnapshot.HabitItem) -> some View {
        let status = habit.todayStatus
        if status == "yes" {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(widgetPink)
                .font(.caption)
        } else if status == "no" {
            Image(systemName: "xmark.circle")
                .foregroundColor(widgetMuted)
                .font(.caption)
        } else {
            Image(systemName: habit.direction == "break" ? "hand.raised" : "leaf")
                .foregroundColor(widgetMuted)
                .font(.caption)
        }
    }
}

struct ProyouCombinedWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ProyouTasksWidgetView(entry: entry)
            Divider().opacity(0.3)
            ProyouHabitsWidgetView(entry: entry)
        }
    }
}

// MARK: - Widget definitions

struct ProyouTasksWidget: Widget {
    let kind = "ProyouTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProyouWidgetProvider()) { entry in
            ProyouTasksWidgetView(entry: entry)
                .widgetURL(URL(string: "proyou://today"))
                .padding(0)
                .background(Color(red: 1.0, green: 0.98, blue: 0.98))
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
                .padding(0)
                .background(Color(red: 1.0, green: 0.98, blue: 0.98))
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
                .padding(0)
                .background(Color(red: 1.0, green: 0.98, blue: 0.98))
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
