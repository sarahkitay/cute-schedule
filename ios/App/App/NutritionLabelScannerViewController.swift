import UIKit
import AVFoundation
import Vision

/// Full-screen live nutrition label scanner with on-screen macro readout and single capture.
final class NutritionLabelScannerViewController: UIViewController {
    var onComplete: (([String: Any]) -> Void)?
    var onCancel: (() -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private let photoOutput = AVCapturePhotoOutput()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let videoQueue = DispatchQueue(label: "proyou.nutrition.scan.video", qos: .userInitiated)

    private var isLiveOcrBusy = false
    private var isProcessingCapture = false
    private var lastLiveOcrAt: TimeInterval = 0
    private let liveOcrInterval: TimeInterval = 0.85

    private let overlayView = UIView()
    private let guideView = UIView()
    private let statusLabel = UILabel()
    private let processingView = UIVisualEffectView(effect: UIBlurEffect(style: .dark))
    private let processingLabel = UILabel()

    private let calCell = MacroHudView(title: "Cal")
    private let proCell = MacroHudView(title: "Pro")
    private let fatCell = MacroHudView(title: "Fat")
    private let carbCell = MacroHudView(title: "Carb")

    private let captureButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    override var prefersStatusBarHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupPreview()
        setupOverlay()
        setupControls()
        requestCameraAccess()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
        layoutGuideFrame()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning { session.stopRunning() }
    }

    private func setupPreview() {
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
    }

    private func setupOverlay() {
        overlayView.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        overlayView.isUserInteractionEnabled = false
        view.addSubview(overlayView)

        guideView.backgroundColor = .clear
        guideView.layer.borderColor = UIColor.white.withAlphaComponent(0.85).cgColor
        guideView.layer.borderWidth = 2
        guideView.layer.cornerRadius = 10
        view.addSubview(guideView)

        statusLabel.text = "Align Nutrition Facts in frame"
        statusLabel.textColor = .white
        statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 2
        view.addSubview(statusLabel)

        let hud = UIStackView(arrangedSubviews: [calCell, proCell, fatCell, carbCell])
        hud.axis = .horizontal
        hud.distribution = .fillEqually
        hud.spacing = 8
        hud.translatesAutoresizingMaskIntoConstraints = false
        hud.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        hud.layer.cornerRadius = 14
        hud.isLayoutMarginsRelativeArrangement = true
        hud.layoutMargins = UIEdgeInsets(top: 10, left: 10, bottom: 10, right: 10)
        hud.tag = 8801
        view.addSubview(hud)

        processingView.isHidden = true
        processingView.layer.cornerRadius = 16
        processingView.clipsToBounds = true
        processingLabel.text = "Processing label…"
        processingLabel.textColor = .white
        processingLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        processingLabel.textAlignment = .center
        processingView.contentView.addSubview(processingLabel)
        view.addSubview(processingView)

        NSLayoutConstraint.activate([
            hud.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            hud.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            hud.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -100),

            processingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            processingView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            processingView.widthAnchor.constraint(equalToConstant: 240),
            processingView.heightAnchor.constraint(equalToConstant: 88),
            processingLabel.centerXAnchor.constraint(equalTo: processingView.contentView.centerXAnchor),
            processingLabel.centerYAnchor.constraint(equalTo: processingView.contentView.centerYAnchor),
        ])
    }

    private func setupControls() {
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cancelButton)

        captureButton.backgroundColor = .white
        captureButton.layer.cornerRadius = 34
        captureButton.layer.borderWidth = 4
        captureButton.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        captureButton.translatesAutoresizingMaskIntoConstraints = false
        captureButton.addTarget(self, action: #selector(captureTapped), for: .touchUpInside)
        view.addSubview(captureButton)

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            captureButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            captureButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            captureButton.widthAnchor.constraint(equalToConstant: 68),
            captureButton.heightAnchor.constraint(equalToConstant: 68),
        ])
    }

    private func layoutGuideFrame() {
        let w = view.bounds.width
        let h = view.bounds.height
        let guideW = w * 0.82
        let guideH = min(h * 0.48, guideW * 1.25)
        let guideX = (w - guideW) / 2
        let guideY = h * 0.22
        guideView.frame = CGRect(x: guideX, y: guideY, width: guideW, height: guideH)
        overlayView.frame = view.bounds
        punchGuideHole()
        statusLabel.frame = CGRect(x: 20, y: guideY - 44, width: w - 40, height: 40)
    }

    private func punchGuideHole() {
        let path = UIBezierPath(rect: overlayView.bounds)
        let hole = UIBezierPath(roundedRect: guideView.frame, cornerRadius: 10)
        path.append(hole)
        path.usesEvenOddFillRule = true
        let mask = CAShapeLayer()
        mask.path = path.cgPath
        mask.fillRule = .evenOdd
        overlayView.layer.mask = mask
    }

    private func guideRegionOfInterest() -> CGRect {
        guard let previewLayer = previewLayer else { return CGRect(x: 0.05, y: 0.1, width: 0.9, height: 0.75) }
        let rect = previewLayer.metadataOutputRectConverted(fromLayerRect: guideView.frame)
        return CGRect(
            x: max(0, min(1, rect.origin.x)),
            y: max(0, min(1, rect.origin.y)),
            width: max(0.2, min(1, rect.width)),
            height: max(0.2, min(1, rect.height))
        )
    }

    private func requestCameraAccess() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted { self?.configureSession() }
                    else { self?.failPermission() }
                }
            }
        default:
            failPermission()
        }
    }

    private func failPermission() {
        statusLabel.text = "Allow camera in Settings → PROYOU → Camera"
    }

    private func configureSession() {
        session.beginConfiguration()
        session.sessionPreset = .photo

        guard
            let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
            let input = try? AVCaptureDeviceInput(device: device),
            session.canAddInput(input)
        else {
            statusLabel.text = "Camera unavailable"
            session.commitConfiguration()
            return
        }
        session.addInput(input)

        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }

        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
        if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }

        session.commitConfiguration()
        videoQueue.async { [weak self] in
            self?.session.startRunning()
        }
    }

    private func updateHud(_ macros: NutritionLabelMacros) {
        calCell.setValue(macros.calories)
        proCell.setValue(macros.protein)
        fatCell.setValue(macros.fat)
        carbCell.setValue(macros.carbs)
        if macros.isComplete {
            statusLabel.text = "Tap ● to capture · all macros found"
        } else if macros.foundCount > 0 {
            statusLabel.text = "Reading… \(macros.foundCount)/4 · hold steady"
        } else {
            statusLabel.text = "Align Nutrition Facts in frame"
        }
    }

    private func runLiveOcr(on pixelBuffer: CVPixelBuffer) {
        let now = CACurrentMediaTime()
        guard !isLiveOcrBusy, !isProcessingCapture, now - lastLiveOcrAt >= liveOcrInterval else { return }
        isLiveOcrBusy = true
        lastLiveOcrAt = now
        let roi = guideRegionOfInterest()
        let request = VNRecognizeTextRequest { [weak self] req, _ in
            defer { self?.isLiveOcrBusy = false }
            guard let self = self, !self.isProcessingCapture else { return }
            guard let observations = req.results as? [VNRecognizedTextObservation] else { return }
            let parsed = NutritionLabelOcr.assembleOcrLines(from: observations)
            let macros = NutritionLabelMacroParser.parse(text: parsed.fullText)
            DispatchQueue.main.async { self.updateHud(macros) }
        }
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.minimumTextHeight = 0.012
        request.regionOfInterest = roi
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right, options: [:])
        try? handler.perform([request])
    }

    private func finishWithImage(_ image: UIImage) {
        guard let cgImage = image.cgImage else {
            statusLabel.text = "Could not process image"
            isProcessingCapture = false
            processingView.isHidden = true
            return
        }
        let uiImage = UIImage(cgImage: cgImage)
        NutritionLabelOcr.recognizeStrong(from: uiImage) { [weak self] result in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.processingView.isHidden = true
                self.isProcessingCapture = false
                switch result {
                case .failure(let err):
                    self.statusLabel.text = err.localizedDescription
                case .success(let ocr):
                    let macros = NutritionLabelMacroParser.parse(text: ocr.fullText)
                    var payload: [String: Any] = [
                        "text": ocr.fullText,
                        "lines": ocr.lines,
                    ]
                    if let jpeg = image.jpegData(compressionQuality: 0.85) {
                        payload["imageBase64"] = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                    }
                    if macros.foundCount >= 2 {
                        payload["macros"] = [
                            "calories": macros.calories ?? 0,
                            "protein": macros.protein ?? 0,
                            "fat": macros.fat ?? 0,
                            "carbs": macros.carbs ?? 0,
                        ]
                    }
                    self.dismiss(animated: true) {
                        self.onComplete?(payload)
                    }
                }
            }
        }
    }

    @objc private func cancelTapped() {
        dismiss(animated: true) { [weak self] in
            self?.onCancel?()
        }
    }

    @objc private func captureTapped() {
        guard !isProcessingCapture, photoOutput.connection(with: .video) != nil else { return }
        isProcessingCapture = true
        processingView.isHidden = false
        statusLabel.text = "Processing…"
        photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
    }
}

extension NutritionLabelScannerViewController: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        runLiveOcr(on: pixelBuffer)
    }
}

extension NutritionLabelScannerViewController: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            DispatchQueue.main.async { [weak self] in
                self?.processingView.isHidden = true
                self?.isProcessingCapture = false
                self?.statusLabel.text = error.localizedDescription
            }
            return
        }
        guard let data = photo.fileDataRepresentation(), let image = UIImage(data: data) else {
            DispatchQueue.main.async { [weak self] in
                self?.processingView.isHidden = true
                self?.isProcessingCapture = false
                self?.statusLabel.text = "Capture failed"
            }
            return
        }
        finishWithImage(image.normalizedUpOrientation())
    }
}

private extension UIImage {
    func normalizedUpOrientation() -> UIImage {
        if imageOrientation == .up { return self }
        UIGraphicsBeginImageContextWithOptions(size, false, scale)
        draw(in: CGRect(origin: .zero, size: size))
        let normalized = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return normalized ?? self
    }
}

// MARK: - Macro HUD cell

private final class MacroHudView: UIView {
    private let titleLabel = UILabel()
    private let valueLabel = UILabel()

    init(title: String) {
        super.init(frame: .zero)
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        titleLabel.textColor = UIColor.white.withAlphaComponent(0.7)
        titleLabel.textAlignment = .center

        valueLabel.text = "-"
        valueLabel.font = .monospacedDigitSystemFont(ofSize: 22, weight: .bold)
        valueLabel.textColor = .white
        valueLabel.textAlignment = .center

        let stack = UIStackView(arrangedSubviews: [titleLabel, valueLabel])
        stack.axis = .vertical
        stack.spacing = 2
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setValue(_ n: Int?) {
        guard let n = n, n > 0 else {
            valueLabel.text = "-"
            valueLabel.textColor = UIColor.white.withAlphaComponent(0.35)
            return
        }
        valueLabel.text = "\(n)"
        valueLabel.textColor = UIColor(red: 0.45, green: 0.92, blue: 0.72, alpha: 1)
    }
}
