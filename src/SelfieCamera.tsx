import React from 'react';
import cv, { CascadeClassifier, Mat, RectVector } from '@techstark/opencv-js';
import { Human } from '@vladmandic/human';
import Poster from './assets/poster.svg';
import { loadHaarFaceModels } from './utils/haarFaceDetection';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.cv = cv;

type SelfieInfo = {
  width: number;
  height: number;
  size: number;
};

type SelfieCameraProps = {
  screenshot?: string;
  setScreenshot: (screenshot: string) => void;
  path?: string;
  mimeType?: 'image/png' | 'image/webp' | 'image/jpeg';
  resolution?: {
    width?: number;
    height?: number;
  };
  setResolution?: (resolution: { width?: number; height?: number }) => void;
  selfieInfo?: (selfieInfo: SelfieInfo) => void;
  retake?: boolean;
};

type VideoConstraints = {
  video: {
    width: {
      exact: number;
    };
    height: {
      exact: number;
    };
  };
};

const constraints: VideoConstraints[] = [
  {
    video: {
      width: { exact: 320 },
      height: { exact: 180 },
    },
  },
  {
    video: { width: { exact: 320 }, height: { exact: 240 } },
  },
  {
    video: { width: { exact: 640 }, height: { exact: 360 } },
  },
  {
    video: { width: { exact: 640 }, height: { exact: 480 } },
  },
  {
    video: { width: { exact: 1280 }, height: { exact: 720 } },
  },
  {
    video: { width: { exact: 1920 }, height: { exact: 1080 } },
  },
];

export function SelfieCamera(props: SelfieCameraProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isFaceWithinFrame, setIsFaceWithinFrame] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [borderColor, setBorderColor] = React.useState('border-red-500');
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);


  const detectFace = async (h: Human) => {
    const video = videoRef.current;
    if (video && h) {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const img = new Image();
        img.src = canvas.toDataURL('image/jpeg');
        img.onload = async () => {
          const result = await h.detect(img);

          if (result.face.length > 0) {
            const { box } = result.face[0];

            const [, , width, height] = box;
            const faceArea = width * height;
            const frameArea = img.width * img.height;

            const leftEye = result.body?.[0]?.keypoints.find(
              (k) => k.part === 'leftEye'
            );
            const rightEye = result.body?.[0]?.keypoints.find(
              (k) => k.part === 'rightEye'
            );
            const leftWrist = result.body?.[0]?.keypoints.find(
              (k) => k.part === 'leftWrist'
            );
            const rightWrist = result.body?.[0]?.keypoints.find(
              (k) => k.part === 'rightWrist'
            );
            const eyesVisible =
              !!leftEye &&
              !!rightEye &&
              leftEye.score > 0.2 &&
              rightEye.score > 0.2;
            const wristsVisible = !!leftWrist || !!rightWrist;

            const gestures = result.gesture;

            const isFacingForward = gestures.some(
              (g) => g.gesture === 'facing center'
            );
            const isMouthVisible = gestures.some((g) =>
              g.gesture.includes('mouth')
            );

            if (!isFacingForward) {
              setBorderColor('border-yellow-900');
              setIsFaceWithinFrame(false);
              setMessage('Face forward');
            }

            if (!isMouthVisible || !eyesVisible) {
              setBorderColor('border-yellow-900');
              setIsFaceWithinFrame(false);
              // setMessage('');
            }

            if (
              faceArea / frameArea > 0.2 &&
              faceArea / frameArea <= 0.8 &&
              isFacingForward &&
              !wristsVisible
            ) {
              setBorderColor('border-lime-500');
              setMessage('Perfect!');
              setIsFaceWithinFrame(true);
            } else if (faceArea / frameArea < 0.2) {
              setBorderColor('border-red-500');
              setMessage('Too far');
              setIsFaceWithinFrame(false);
            } else if (isFacingForward && faceArea / frameArea > 0.8) {
              setBorderColor('border-yellow-900');
              setMessage('Too close');
              setIsFaceWithinFrame(false);
            }
          } else {
            setMessage('No face detected');
          }
        };
      }
    }
  };

  const calculateBase64ImageSize = (base64String: string): number => {
    const stringLength = base64String.length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;
    return sizeInBytes; // Size in bytes
  };

  const processImage = (imageSrc: string, factor = 0.25) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const minNeighbors = 5;
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.src = imageSrc;

    image.onload = async () => {
      canvas.width = image.width;
      canvas.height = image.height;
      if (!ctx) return;

      ctx.drawImage(image, 0, 0, image.width, image.height);

      let gray: Mat | undefined;
      let faces: RectVector | undefined;
      let faceCascade: CascadeClassifier | undefined;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const src = cv.matFromImageData(imageData);

      try {
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        faces = new cv.RectVector();
        faceCascade = new cv.CascadeClassifier();
        faceCascade.load('haarcascade_frontalface_default.xml');

        // Face detection
        const srcWidth = src.size().width;
        const srcHeight = src.size().height;
        const srcMin = Math.min(srcWidth, srcHeight);

        const minSize = new cv.Size(srcMin * 0.05, srcMin * 0.05);
        const maxSize = new cv.Size(0, 0);
        faceCascade.detectMultiScale(
          gray,
          faces,
          1.3,
          minNeighbors,
          0,
          minSize,
          maxSize
        );

        if (faces.size() === 0) {
          throw new Error('No faces detected');
        }

        // Crop the first detected face
        const face = faces.get(0);
        const point1 = new cv.Point(face.x, face.y);
        const point2 = new cv.Point(face.x + face.width, face.y + face.height);

        const faceWidth = point2.x - point1.x;

        // Adjust factor based on face size.
        const adjustedFactor = faceWidth * factor;

        point1.x = Math.max(point1.x - adjustedFactor, 0);
        point1.y = Math.max(point1.y - adjustedFactor * 1.95, 0);
        point2.x = Math.min(point2.x + adjustedFactor, srcWidth);
        point2.y = Math.min(point2.y + adjustedFactor * 1.9, srcHeight);

        if (point1.x < 0 || point1.y < 0 || point2.x < 0 || point2.y < 0)
          throw new Error('Error: Factor passed is too high/low.');

        // Calculate the face bounding box dimensions
        const rect = new cv.Rect(
          point1.x,
          point1.y,
          point2.x - point1.x,
          point2.y - point1.y
        );

        const dst = src.roi(rect);

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = point2.x - point1.x;
          canvas.height = point2.y - point1.y;

          // Create a canvas to show the cropped face
          const processedCanvas = document.createElement('canvas');
          processedCanvas.width = dst.size().width;
          processedCanvas.height = dst.size().height;
          cv.imshow(processedCanvas, dst);

          // Get the processed image as a data URL
          const processedImageSrc = processedCanvas.toDataURL('image/jpeg');
          props.setScreenshot(processedImageSrc);

          // This will be used to log the image size, width, and height
          const sizeInBytes = calculateBase64ImageSize(processedImageSrc);
          const sizeInKB = sizeInBytes / 1024;
          props.selfieInfo?.({
            width: processedCanvas.width,
            height: processedCanvas.height,
            size: sizeInKB,
          });
        }

      } catch (e) {
        console.error(e);
      } finally {
        // Clean up memory
        image?.remove();
        src?.delete();
        gray?.delete();
        faces?.delete();
        faceCascade?.delete();
      }
    };
  };

  const captureScreenshot = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        processImage(dataUrl);
      }
    }
  };

  React.useEffect(() => {
    const loadHuman = async () => {
      const humanInstance = new Human({
        modelBasePath: 'https://vladmandic.github.io/human/models',
      });
      await humanInstance.load();
      return humanInstance;
    };

    let interval: NodeJS.Timeout | undefined;

    loadHuman().then((h) => {
      console.log('Human loaded');
      interval = setInterval(() => detectFace(h), 300);
    });

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    loadHaarFaceModels();
  }, []);

  const startCameraWithConstraints = React.useCallback(async () => {
    const reversedConstraints = [...constraints].reverse();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    for (let i = 0; i < reversedConstraints.length; i++) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia(reversedConstraints[i]);
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play();
        }
        return;
      } catch (err) {
        console.warn(`Failed to apply constraint ${i}:`, reversedConstraints[i], err);
      }
    }

    throw new Error('Failed to start camera with any of the given constraints.');
  }, []);

  React.useEffect(() => {
    startCameraWithConstraints();
  }, [startCameraWithConstraints]);

  return (
    <div className='flex flex-col items-center p-5'>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {props.screenshot && (
        <div className='relative mb-5 overflow-hidden w-75 h-100 '>
          <img className='h-full' src={props.screenshot} alt='Screenshot' />
          {/* <div
            className={`absolute top-0 left-0 w-full h-full rounded-1/2 border-8 border-lime-600`}
          /> */}
        </div>
      )}
      {!props.screenshot && (
        <div className='relative w-full h-auto mb-5 overflow-hidden md:w-75 md:h-100 rounded-1/2'>
          <video
            width={300}
            height={400}
            poster={Poster}
            className='object-cover w-[70vh] h-[70vh] md:w-full md:h-full rounded-full'
            autoPlay
            muted
            playsInline
            ref={videoRef}
          />
          <div
            className={`absolute top-0 left-0 w-full h-full rounded-1/2 border-8 ${borderColor}`}
          />
          {message && (
            <div className='text-black absolute bottom-[40px] p-2 rounded-md bg-opacity-40 bg-white right-[120px]'>
              <p>{message}</p>
            </div>
          )}
        </div>
      )}

      <div className='flex flex-col items-center gap-3 text-black-pure'>
        <p className='text-3xl'>
          {props.screenshot
            ? 'Is it clear enough?'
            : 'Take a selfie'}
        </p>
        <p className='text-base'>
          {props.screenshot
            ? 'Make sure your entire face is visible'
            : 'Place your face in the oval. Take picture when the button turns green.'}
        </p>
        {!props.screenshot && (
          <button
            onClick={() => isFaceWithinFrame && captureScreenshot()}
            className={`border  ${
              isFaceWithinFrame
                ? 'bg-lime-600 border-lime-600 active:bg-lime-800'
                : 'bg-grey-300 border-grey-300'
            } w-22.5 h-22.5 rounded-full`}
          >
            <div className='w-full h-full border-2 border-white rounded-full' />
          </button>
        )}
      </div>
    </div>
  );
}
