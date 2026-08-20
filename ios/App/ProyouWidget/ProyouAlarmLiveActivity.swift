#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
import AppIntents
import SwiftUI
import WidgetKit

private let livePink = Color(red: 0.909, green: 0.663, blue: 0.718)
private let livePinkDeep = Color(red: 0.831, green: 0.439, blue: 0.541)
private let liveInk = Color(red: 0.18, green: 0.12, blue: 0.14)
private let liveSoft = Color(red: 0.96, green: 0.92, blue: 0.94)

@available(iOS 26.0, *)
struct ProyouAlarmCountdownText: View {
    let state: AlarmPresentationState

    var body: some View {
        switch state.mode {
        case .countdown(let info):
            Text(info.fireDate, style: .timer)
                .monospacedDigit()
        case .paused(let info):
            let remaining = max(0, info.totalCountdownDuration - info.previouslyElapsedDuration)
            Text(Duration.seconds(remaining), format: .time(pattern: .minuteSecond))
                .monospacedDigit()
        case .alert:
            Image(systemName: "bell.fill")
        @unknown default:
            Text("--:--").monospacedDigit()
        }
    }
}

@available(iOS 26.0, *)
struct ProyouLockScreenPuzzleBoard: View {
    let alarmKitId: String
    let tiles: [Int]

    var body: some View {
        VStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { row in
                HStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { col in
                        let idx = row * 3 + col
                        let value = idx < tiles.count ? tiles[idx] : 0
                        if value == 0 {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(liveSoft.opacity(0.35))
                                .frame(width: 34, height: 34)
                        } else {
                            Button(intent: ProyouWakePuzzleTapIntent(alarmKitId: alarmKitId, tileIndex: idx)) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        .fill(livePink.opacity(0.22))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                                .stroke(livePink.opacity(0.45), lineWidth: 1)
                                        )
                                    Text("\(value)")
                                        .font(.caption.bold())
                                        .foregroundStyle(liveInk)
                                }
                                .frame(width: 34, height: 34)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }
}

@available(iOS 26.0, *)
struct ProyouLockScreenChoiceButtons: View {
    let alarmKitId: String
    let choices: [String]

    var body: some View {
        VStack(spacing: 6) {
            ForEach(Array(choices.enumerated()), id: \.offset) { index, choice in
                Button(intent: ProyouWakePickAnswerIntent(alarmKitId: alarmKitId, choiceIndex: index)) {
                    Text(choice)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(liveInk)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(livePink.opacity(0.18))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

@available(iOS 26.0, *)
struct ProyouMorningAlarmLockScreenView: View {
    let context: ActivityViewContext<AlarmAttributes<ProyouAlarmMetadata>>

    private var meta: ProyouAlarmMetadata? { context.attributes.metadata }
    private var alarmKitId: String {
        let fromMeta = meta?.alarmKitUUID ?? ""
        if !fromMeta.isEmpty { return fromMeta }
        return ""
    }

    private var isAlert: Bool {
        if case .alert = context.state.mode { return true }
        return false
    }

    var body: some View {
        let label = meta?.alarmLabel.isEmpty == false ? meta!.alarmLabel : "Morning alarm"
        let mode = meta?.wakeMode ?? "standard"
        let needsChallenge = ProyouWakeChallengeEngine.needsChallenge(mode: mode)
        let isPuzzle = mode == "puzzle"
        let activeSession: ProyouWakeChallengeSession? = {
            guard needsChallenge, isAlert, !alarmKitId.isEmpty else { return nil }
            return ProyouWakeChallengeStore.ensureSession(
                alarmKitId: alarmKitId,
                proyouAlarmId: meta?.proyouAlarmId ?? "",
                mode: mode
            )
        }()

        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: isPuzzle ? "puzzlepiece.extension.fill" : "alarm.fill")
                    .font(.title3)
                    .foregroundStyle(livePinkDeep)
                VStack(alignment: .leading, spacing: 4) {
                    Text(label)
                        .font(.headline)
                        .foregroundStyle(liveInk)
                        .lineLimit(2)
                    if isAlert && needsChallenge {
                        Text("Wake-up game on lock screen")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(livePinkDeep)
                    } else if isAlert {
                        Text("PROYOU alarm")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 0)
                ProyouAlarmCountdownText(state: context.state)
                    .font(.title3.bold())
                    .foregroundStyle(livePinkDeep)
            }

            if isAlert, let session = activeSession, !session.completed {
                let roundLabel = "Step \(min(session.round + 1, session.totalRounds)) of \(session.totalRounds)"
                Text(roundLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                if !session.lastError.isEmpty {
                    Text(session.lastError)
                        .font(.caption2)
                        .foregroundStyle(.red.opacity(0.85))
                }

                if session.mode == "puzzle" {
                    ProyouLockScreenPuzzleBoard(alarmKitId: alarmKitId, tiles: session.current.puzzleTiles)
                    Text("Order tiles 1-8 to dismiss")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else if session.mode == "action_required" {
                    Text("Tap the exact phrase:")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(liveInk)
                    Text("\"\(session.current.prompt)\"")
                        .font(.caption)
                        .foregroundStyle(liveInk)
                        .fixedSize(horizontal: false, vertical: true)
                    ProyouLockScreenChoiceButtons(alarmKitId: alarmKitId, choices: session.current.choices)
                } else {
                    Text(session.current.prompt)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(liveInk)
                        .fixedSize(horizontal: false, vertical: true)
                    ProyouLockScreenChoiceButtons(alarmKitId: alarmKitId, choices: session.current.choices)
                }
            } else if isAlert, let session = activeSession, session.completed {
                Text("Nice work. Alarm dismissed.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(livePinkDeep)
            }
        }
        .padding(14)
    }
}

@available(iOS 26.0, *)
struct ProyouFocusTimerLockScreenView: View {
    let context: ActivityViewContext<AlarmAttributes<ProyouFocusTimerMetadata>>

    var body: some View {
        let label = context.attributes.metadata?.label ?? "Focus timer"
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "timer")
                    .foregroundStyle(livePink)
                Text(label)
                    .font(.headline)
                    .foregroundStyle(liveInk)
                    .lineLimit(1)
                Spacer(minLength: 0)
                ProyouAlarmCountdownText(state: context.state)
                    .font(.title3.bold())
                    .foregroundStyle(livePink)
            }
            switch context.state.mode {
            case .countdown(let info):
                ProgressView(
                    value: info.previouslyElapsedDuration,
                    total: max(info.totalCountdownDuration, 1)
                )
                .tint(livePink)
            case .paused:
                Label("Paused", systemImage: "pause.fill")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            default:
                EmptyView()
            }
        }
        .padding(14)
    }
}

@available(iOS 26.0, *)
struct ProyouFocusTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<ProyouFocusTimerMetadata>.self) { context in
            ProyouFocusTimerLockScreenView(context: context)
        } dynamicIsland: { context in
            let label = context.attributes.metadata?.label ?? "Focus"
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "timer")
                        .foregroundStyle(livePink)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ProyouAlarmCountdownText(state: context.state)
                        .font(.title3.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(label)
                        .font(.headline)
                        .lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(livePink)
            } compactTrailing: {
                ProyouAlarmCountdownText(state: context.state)
                    .font(.caption.monospacedDigit())
                    .frame(minWidth: 44)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(livePink)
            }
            .keylineTint(livePink)
        }
    }
}

@available(iOS 26.0, *)
struct ProyouMorningAlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<ProyouAlarmMetadata>.self) { context in
            ProyouMorningAlarmLockScreenView(context: context)
        } dynamicIsland: { context in
            let label = context.attributes.metadata?.alarmLabel ?? "Alarm"
            let isPuzzle = context.attributes.metadata?.wakeMode == "puzzle"
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: isPuzzle ? "puzzlepiece.extension.fill" : "alarm.fill")
                        .foregroundStyle(livePink)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ProyouAlarmCountdownText(state: context.state)
                        .font(.title3.monospacedDigit())
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(label)
                        .font(.headline)
                        .lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: isPuzzle ? "puzzlepiece.extension" : "alarm.fill")
                    .foregroundStyle(livePink)
            } compactTrailing: {
                ProyouAlarmCountdownText(state: context.state)
                    .font(.caption.monospacedDigit())
            } minimal: {
                Image(systemName: isPuzzle ? "puzzlepiece.extension" : "alarm.fill")
                    .foregroundStyle(livePink)
            }
            .keylineTint(livePink)
        }
    }
}
#endif
