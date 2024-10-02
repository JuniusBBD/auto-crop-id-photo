import React from 'react';
import cv, { CascadeClassifier, Mat, RectVector } from '@techstark/opencv-js';
import { Human } from '@vladmandic/human';
// import { CascadeClassifier, Mat, RectVector } from 'mirada';
import { loadHaarFaceModels } from './utils/haarFaceDetection';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
window.cv = cv;

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
  cameraInfo?: DeviceInfo | null;
  setCameraInfo?: (cameraInfo: DeviceInfo | null) => void;
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

export enum ResolutionOptionType {
  AUTO,
  MAXIMUM,
  NEAREST,
}

export type AutoResolution = {
  type: ResolutionOptionType.AUTO;
};

export type MaximumResolution = {
  type: ResolutionOptionType.MAXIMUM;
};

export type NearestResolution = {
  type: ResolutionOptionType.NEAREST;
  width: number;
  height: number;
};

export type ImageCaptureResolutionHint =
  | NearestResolution
  | MaximumResolution
  | AutoResolution;

export enum ImageMirrorBehavior {
  FLIP_WHEN_USER_FACING,
  NO_FLIPPING,
}

export type DeviceInfo = {
  deviceId: string;
  video: {
    isFacingUser?: boolean;
    captureResolution?: {
      width: number;
      height: number;
    };
    displayResolution?: {
      width: number;
      height: number;
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
  let videoStream: MediaStream | null = null;
  const [isFaceWithinFrame, setIsFaceWithinFrame] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [borderColor, setBorderColor] = React.useState('border-red-500');
  const [constraintIndex, setConstraintIndex] = React.useState(5);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[] | null>(null);

  const handleDevices = React.useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const devicesNew = mediaDevices.filter(({ kind }) => kind === 'videoinput');
    setDevices(devicesNew);
  }, []);

  const getCurrentDeviceInfo = async (
    deviceId: string
  ): Promise<DeviceInfo | undefined> => {
    const deviceInfo: DeviceInfo = {
      deviceId: deviceId,
      video: {},
    };
    const currentConstraints = constraints[constraintIndex];
    const camConstraints: MediaStreamConstraints = {
      audio: false,
      video: {
        deviceId: deviceId,
        ...currentConstraints.video,
      },
    };

    return navigator.mediaDevices
      .getUserMedia(camConstraints)
      .then((stream) => {
        if (stream) {
          if (props.setResolution) {
            const videoTrack = stream.getVideoTracks()[0];
            const { width, height } = videoTrack.getSettings();
            props.setResolution({ width, height });
          }
          videoStream = stream;
          videoRef.current!.srcObject = stream;
        }

        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];

          const videoTrackSettings = videoTrack.getSettings();
          if (
            videoTrackSettings.height !== undefined &&
            videoTrackSettings.width !== undefined
          ) {
            deviceInfo.video.captureResolution = {
              height: videoTrackSettings.height,
              width: videoTrackSettings.width,
            };
          }

          if (videoTrackSettings.facingMode !== undefined) {
            deviceInfo.video.isFacingUser =
              videoTrackSettings.facingMode.indexOf('user') >= 0;
          }

          // stream.getTracks().forEach((track) => track.stop());
        }

        return deviceInfo;
      })
      .catch(() => {
        throw new Error("Couldn't get user media");
      });
  };

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
              // isMouthVisible &&
              // eyesVisible &&
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
          }
        };
      }
    }
  };

  const processImage = (imageSrc: string, factor = 0.25) => {
    // if (!opencvReady) {
    //  setStatus('OpenCV not ready.');
    //   return;
    // }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const minNeighbors = 5;
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.src = imageSrc;

    image.onload = async () => {
      canvas.width = image.width;
      canvas.height = image.height;
      console.log('Image dimension:', image.width, image.height);
      if (!ctx) return;

      ctx.drawImage(image, 0, 0, image.width, image.height);

      let gray: Mat | undefined;
      let faces: RectVector | undefined;
      let faceCascade: CascadeClassifier | undefined;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const src = cv.matFromImageData(imageData);

      try {
        // setStatus('Processing image...');
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        faces = new cv.RectVector();
        faceCascade = new cv.CascadeClassifier();

        // Fetch Haar Cascade file and load it into OpenCV
        // const response = await fetch('haarcascade_frontalface_default.xml');
        // const xmlText = await response.text();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // cv.FS_createDataFile(
        //   '/',
        //   'haarcascade_frontalface_default.xml',
        //   xmlText,
        //   true,
        //   true
        // );
        faceCascade.load('haarcascade_frontalface_default.xml');

        // Face detection
        const srcWidth = src.size().width;
        const srcHeight = src.size().height;
        const srcMin = Math.min(srcWidth, srcHeight);

        console.log(
          'Image size:',
          srcWidth,
          srcHeight,
          srcWidth * 0.05,
          srcHeight * 0.05
        );

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

        console.log('Face detected:', faces.size());

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
          canvas.width = point2.x - point1.x; // Adjusted faceWidth
          canvas.height = point2.y - point1.y; // Adjusted faceHeight

          // Create a canvas to show the cropped face
          const processedCanvas = document.createElement('canvas');
          processedCanvas.width = dst.size().width;
          processedCanvas.height = dst.size().height;
          cv.imshow(processedCanvas, dst);

          // Get the processed image as a data URL
          const processedImageSrc = processedCanvas.toDataURL('image/jpeg');
          props.setScreenshot(processedImageSrc);

          if (videoStream) {
            videoStream.getVideoTracks().forEach((track) => track.stop());
          }

          // const sizeInBytes = calculateBase64ImageSize(processedImageSrc);
          // const sizeInKB = sizeInBytes / 1024;
          // setProcessedImageInfo({
          //   width: processedCanvas.width,
          //   height: processedCanvas.height,
          //   size: sizeInKB,
          // });
        }

        // setStatus('Face detected and cropped.');
        // setHasFace(true);
      } catch (e) {
        console.error(e);
        // setStatus((e as Error).message);
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

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        // Draw the current frame from the video onto the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Convert the canvas content to a data URL (image)
        const dataUrl = canvas.toDataURL('image/jpeg');
        processImage(dataUrl); // Save image data URL to state
      }
    }
  };

  // React.useEffect(() => {
  //   // Load OpenCV.js and run the detection once OpenCV is ready
  //   loadOpenCV()
  //     .then(() => {
  //       // setOpencvReady(true);
  //       console.log('OpenCV.js loaded.');
  //       // setStatus('Camera ready.');
  //     })
  //     .catch(console.error);
  // }, []);

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
      interval = setInterval(() => detectFace(h), 500);
    });

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  React.useEffect(() => {
    if (devices) {
      if (props.setCameraInfo) {
        props.setCameraInfo(null);
      }
      if (devices.length > 0) {
        const deviceId = devices[0].deviceId;
        getCurrentDeviceInfo(deviceId)
          .then((currentDeviceInfoNew) => {
            if (currentDeviceInfoNew && props.setCameraInfo) {
              props.setCameraInfo(currentDeviceInfoNew);
            }
          })
          .catch((error) => {
            if (
              error &&
              (error as Error).message === "Couldn't get user media"
            ) {
              console.log('Error getting user media');
              setConstraintIndex(constraintIndex - 1);
            }
          });
      } else {
        console.error('No video devices found');
      }
    }
  }, [devices, constraintIndex, props.retake]);

  React.useEffect(() => {
    loadHaarFaceModels();
  }, []);

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
      <video
        // width={300}
        // height={400}
        // className='object-cover w-full h-full rounded-full'
        autoPlay
        ref={videoRef}
      />
    </div>
  );
}
