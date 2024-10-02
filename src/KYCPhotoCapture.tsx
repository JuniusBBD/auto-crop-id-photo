import * as faceapi from 'face-api.js';
import React, { useRef, useState } from 'react';

const KYCPhotoCapture = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null); // State to store cropped image

  // Start webcam stream
  const startWebcam = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const takeScreenshot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame on canvas
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg');
      setScreenshot(imageData); // Store full screenshot before cropping
      await detectFace(canvas);
    }
  };

  // Detect face using face-api.js
  const detectFace = async (canvas: HTMLCanvasElement) => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/models'); // Load face detection model
    const detections = await faceapi.detectAllFaces(canvas); // Detect all faces in the image

    if (detections.length > 0) {
      const faceBox = detections[0].box;
      cropToIDFormat(canvas, faceBox); // Pass the detected face box for cropping
    } else {
      console.log('No face detected');
    }
  };

  const cropToIDFormat = (canvas: HTMLCanvasElement, box: faceapi.Box) => {
    const { x, y, width, height } = box;
    console.log('Face box:', box);

    // Define target dimensions in pixels (35x45 mm at 300 DPI)
    const targetWidth = 413; // 35 mm
    let targetHeight = 531; // 45 mm

      // Ensure targetHeight does not exceed canvas height
  if (targetHeight > canvas.height) {
    targetHeight = canvas.height; // Set to canvas height if greater
  }

    // Calculate the center of the face box
    const centerX = x + width / 2;

    // Set cropY to ensure the cropping area ends 30px below the face box
    const cropY = y + height - targetHeight + 30; // Adjust so it ends 30px below

    // Calculate cropX, ensuring it stays within canvas bounds
    const cropX = Math.max(0, centerX - targetWidth / 2);

    // Ensure the cropping area does not exceed the canvas dimensions
    const cropWidth = Math.min(targetWidth, canvas.width - cropX);
    const cropHeight = Math.min(targetHeight, canvas.height - cropY);

    console.log('Cropping area:', { cropX, cropY, cropWidth, cropHeight });

    // Create a new canvas to store the cropped ID image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    const tempContext = tempCanvas.getContext('2d');

    if (tempContext) {
      // Draw the cropped area from the original canvas onto the temporary canvas
      tempContext.drawImage(
        canvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      const croppedDataURL = tempCanvas.toDataURL('image/jpeg'); // Convert to base64
      setScreenshot(croppedDataURL); // Set the cropped image for display
    }
  };



  const submitForKYC = () => {
    if (croppedImage) {
      const blob = dataURItoBlob(croppedImage);
      const formData = new FormData();
      formData.append('file', blob, 'photo-id.jpg');

      fetch('/kyc/upload', {
        method: 'POST',
        body: formData,
      }).then((response) => {
        console.log('Uploaded for KYC');
      });
    }
  };

  // Helper to convert base64 image to blob
  const dataURItoBlob = (dataURI: string) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const buffer = new ArrayBuffer(byteString.length);
    const dataView = new Uint8Array(buffer);
    for (let i = 0; i < byteString.length; i++) {
      dataView[i] = byteString.charCodeAt(i);
    }
    return new Blob([buffer], { type: mimeString });
  };

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button onClick={startWebcam}>Start Webcam</button>
      <button onClick={takeScreenshot}>Take Photo</button>

      {screenshot && (
        <div>
          <h3>Original Screenshot</h3>
          <img src={screenshot} alt="Screenshot" />
        </div>
      )}

      {croppedImage && (
        <div>
          <h3>Cropped Photo ID</h3>
          <img src={croppedImage} alt="Cropped ID" /> {/* Display cropped image */}
          <button onClick={submitForKYC}>Submit for KYC</button>
        </div>
      )}
    </div>
  );
};

export default KYCPhotoCapture;
