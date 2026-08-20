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
        let now = Date()
        let entry = ProyouWidgetEntry(date: now, snapshot: snap)

        let cal = Calendar.current
        let minute = cal.component(.minute, from: now)
        let minutesToQuarter = 15 - (minute % 15)
        var next = cal.date(byAdding: .minute, value: minutesToQuarter == 15 ? 15 : minutesToQuarter, to: now) ?? now.addingTimeInterval(900)

        if let timer = snap.activeTimer, let endsMs = timer.endsAtMs {
            let ends = Date(timeIntervalSince1970: endsMs / 1000)
            if ends > now && ends < next { next = ends }
        }

        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Design tokens (ProYou pink)

private let widgetPink = Color(red: 0.909, green: 0.663, blue: 0.718)
private let widgetPinkDeep = Color(red: 0.831, green: 0.439, blue: 0.541)
private let widgetPinkSoft = Color(red: 0.909, green: 0.663, blue: 0.718, opacity: 0.22)
private let widgetCream = Color(red: 1.0, green: 0.98, blue: 0.97)
private let widgetBlush = Color(red: 0.99, green: 0.94, blue: 0.95)
private let widgetInk = Color(red: 0.18, green: 0.12, blue: 0.14)
private let widgetMuted = Color(red: 0.45, green: 0.38, blue: 0.40)

private var widgetBackground: some View {
    ZStack {
        LinearGradient(
            colors: [widgetCream, widgetBlush, Color(red: 0.98, green: 0.92, blue: 0.94)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        Circle()
            .fill(widgetPink.opacity(0.18))
            .frame(width: 120, height: 120)
            .offset(x: -50, y: -40)
        Circle()
            .fill(widgetPinkDeep.opacity(0.12))
            .frame(width: 90, height: 90)
            .offset(x: 60, y: 50)
    }
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

private func formatHour12(_ hourKey: String) -> String {
    let parts = hourKey.split(separator: ":")
    guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return hourKey }
    let suffix = h >= 12 ? "PM" : "AM"
    let h12 = h % 12 == 0 ? 12 : h % 12
    if m == 0 { return "\(h12) \(suffix)" }
    return String(format: "%d:%02d %@", h12, m, suffix)
}

private func widgetActionURL(action: String, task: ProyouWidgetSnapshot.CurrentTaskInfo?, minutes: Int = 25) -> URL {
    var comp = URLComponents()
    comp.scheme = "proyou"
    comp.host = "today"
    var items = [URLQueryItem(name: "widget", value: action)]
    if let task {
        items.append(URLQueryItem(name: "dayKey", value: task.dayKey))
        items.append(URLQueryItem(name: "hourKey", value: task.hourKey))
        items.append(URLQueryItem(name: "category", value: task.category))
        items.append(URLQueryItem(name: "taskId", value: task.id))
    }
    if action == "timer" {
        items.append(URLQueryItem(name: "minutes", value: String(minutes)))
    }
    comp.queryItems = items
    return comp.url ?? URL(string: "proyou://today?widget=add")!
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
            Text(timer.linkedTaskText?.isEmpty == false ? timer.linkedTaskText! : timer.label)
                .font(.system(size: 9, weight: .medium))
                .foregroundColor(.white.opacity(0.92))
                .lineLimit(1)
        }
        Spacer(minLength: 0)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .background(
        LinearGradient(colors: [widgetPinkDeep, widgetPink], startPoint: .leading, endPoint: .trailing)
    )
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .shadow(color: widgetPinkDeep.opacity(0.25), radius: 6, y: 3)
}

@ViewBuilder
private func widgetBubblyPill<Content: View>(
    @ViewBuilder content: () -> Content
) -> some View {
    content()
        .font(.system(size: 11, weight: .bold))
        .foregroundColor(widgetPinkDeep)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(
            Capsule()
                .fill(Color.white.opacity(0.88))
                .overlay(Capsule().stroke(widgetPink.opacity(0.45), lineWidth: 1))
        )
        .shadow(color: widgetPink.opacity(0.12), radius: 4, y: 2)
}

@ViewBuilder
private func widgetPrimaryPill(title: String, icon: String) -> some View {
    HStack(spacing: 6) {
        Image(systemName: icon)
            .font(.system(size: 11, weight: .bold))
        Text(title)
    }
    .font(.system(size: 12, weight: .bold))
    .foregroundColor(.white)
    .padding(.horizontal, 14)
    .padding(.vertical, 9)
    .background(
        LinearGradient(colors: [widgetPink, widgetPinkDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
    )
    .clipShape(Capsule())
    .shadow(color: widgetPinkDeep.opacity(0.3), radius: 6, y: 3)
}

@ViewBuilder
private func widgetActionLink(action: String, task: ProyouWidgetSnapshot.CurrentTaskInfo?, label: String, icon: String) -> some View {
    if #available(iOS 17.0, *) {
        Link(destination: widgetActionURL(action: action, task: task)) {
            widgetBubblyPill {
                HStack(spacing: 4) {
                    Image(systemName: icon)
                    Text(label)
                }
            }
        }
    } else {
        widgetBubblyPill {
            HStack(spacing: 4) {
                Image(systemName: icon)
                Text(label)
            }
        }
    }
}

@ViewBuilder
private func widgetCurrentTaskCard(_ task: ProyouWidgetSnapshot.CurrentTaskInfo, openCount: Int) -> some View {
    VStack(alignment: .leading, spacing: 10) {
        HStack {
            Text("Current task")
                .font(.system(size: 10, weight: .heavy))
                .foregroundColor(widgetPinkDeep)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(widgetPinkSoft)
                .clipShape(Capsule())
            Spacer(minLength: 0)
            if openCount > 0 {
                Text("\(openCount) left")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(widgetMuted)
            }
        }

        VStack(alignment: .leading, spacing: 4) {
            Text(task.text)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(widgetInk)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            Text(formatHour12(task.hourKey))
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(widgetMuted)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(widgetPink.opacity(0.35), lineWidth: 1)
        )

        HStack(spacing: 6) {
            widgetActionLink(action: "timer", task: task, label: "Timer", icon: "timer")
            widgetActionLink(action: "skip", task: task, label: "Next", icon: "forward.fill")
            widgetActionLink(action: "complete", task: task, label: "Done", icon: "checkmark")
        }
    }
}

@ViewBuilder
private func widgetEmptyDayView() -> some View {
    VStack(spacing: 12) {
        Spacer(minLength: 0)
        Image(systemName: "sparkles")
            .font(.title2)
            .foregroundColor(widgetPink)
        Text("No tasks yet today")
            .font(.caption.weight(.semibold))
            .foregroundColor(widgetMuted)
            .multilineTextAlignment(.center)
        if #available(iOS 17.0, *) {
            Link(destination: widgetActionURL(action: "add", task: nil)) {
                widgetPrimaryPill(title: "Add task", icon: "plus")
            }
        } else {
            widgetPrimaryPill(title: "Add task", icon: "plus")
        }
        Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
}

// MARK: - Views

struct ProyouTasksWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        let snap = entry.snapshot
        let hasTasks = snap.hasTasks ?? !snap.tasks.isEmpty
        let current = snap.currentTask
        let openCount = snap.openTaskCount ?? snap.tasks.filter { !$0.done }.count

        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Text("PROYOU")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundColor(widgetPinkDeep)
                Text("✨")
                    .font(.caption)
                Spacer(minLength: 0)
            }

            if let timer = snap.activeTimer, timer.remainingSec > 0 {
                widgetTimerBanner(timer)
            }

            if !hasTasks {
                widgetEmptyDayView()
            } else if let current {
                widgetCurrentTaskCard(current, openCount: openCount)
            } else {
                VStack(spacing: 10) {
                    Text("All done for today!")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(widgetPinkDeep)
                    if #available(iOS 17.0, *) {
                        Link(destination: widgetActionURL(action: "add", task: nil)) {
                            widgetPrimaryPill(title: "Add task", icon: "plus")
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
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
            HStack {
                Text("Habits")
                    .font(.subheadline.weight(.heavy))
                    .foregroundColor(widgetInk)
                Text("🌿")
                    .font(.caption)
                Spacer(minLength: 0)
            }

            if let timer = entry.snapshot.activeTimer, timer.remainingSec > 0 {
                widgetTimerBanner(timer)
            }

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
                    .padding(.vertical, 6)
                    .padding(.horizontal, 10)
                    .background(Color.white.opacity(0.65))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(widgetPink.opacity(0.25), lineWidth: 1)
                    )
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
                .foregroundColor(widgetPinkDeep)
                .font(.caption)
        } else if status == "no" {
            Image(systemName: "xmark.circle.fill")
                .foregroundColor(widgetMuted)
                .font(.caption)
        } else {
            Image(systemName: habit.direction == "break" ? "hand.raised.fill" : "leaf.fill")
                .foregroundColor(widgetPink)
                .font(.caption)
        }
    }
}

struct ProyouCombinedWidgetView: View {
    var entry: ProyouWidgetEntry

    var body: some View {
        let snap = entry.snapshot
        let hasTasks = snap.hasTasks ?? !snap.tasks.isEmpty
        let current = snap.currentTask

        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("PROYOU")
                    .font(.subheadline.weight(.heavy))
                    .foregroundColor(widgetPinkDeep)
                Spacer(minLength: 0)
            }

            if let timer = snap.activeTimer, timer.remainingSec > 0 {
                widgetTimerBanner(timer)
            }

            if !hasTasks {
                widgetEmptyDayView()
            } else if let current {
                widgetCurrentTaskCard(current, openCount: snap.openTaskCount ?? 0)
            }

            if !snap.habits.isEmpty {
                Divider().overlay(widgetPink.opacity(0.25))
                Text("Habits")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(widgetMuted)
                ForEach(Array(snap.habits.prefix(2))) { habit in
                    Text(habit.label)
                        .font(.caption)
                        .foregroundColor(widgetInk)
                        .lineLimit(1)
                }
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
            if #available(iOS 17.0, *) {
                ProyouTasksWidgetView(entry: entry)
                    .containerBackground(for: .widget) { widgetBackground }
            } else {
                ProyouTasksWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Today's tasks")
        .description("Your current task with quick actions.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct ProyouHabitsWidget: Widget {
    let kind = "ProyouHabitsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProyouWidgetProvider()) { entry in
            if #available(iOS 17.0, *) {
                ProyouHabitsWidgetView(entry: entry)
                    .containerBackground(for: .widget) { widgetBackground }
            } else {
                ProyouHabitsWidgetView(entry: entry)
            }
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
            if #available(iOS 17.0, *) {
                ProyouCombinedWidgetView(entry: entry)
                    .containerBackground(for: .widget) { widgetBackground }
            } else {
                ProyouCombinedWidgetView(entry: entry)
            }
        }
        .configurationDisplayName("Tasks & habits")
        .description("Current task plus habits at a glance.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

@main
struct ProyouWidgetBundle: WidgetBundle {
    var body: some Widget {
        ProyouTasksWidget()
        ProyouHabitsWidget()
        ProyouCombinedWidget()
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            ProyouFocusTimerLiveActivity()
            ProyouMorningAlarmLiveActivity()
        }
        #endif
    }
}
