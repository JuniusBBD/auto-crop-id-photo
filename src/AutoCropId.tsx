import React, { useState, useCallback, useEffect } from 'react';
import Webcam, { WebcamProps } from 'react-webcam';
import 'mirada/dist/src/types/opencv/_types';
import Poster from './assets/poster.svg';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { CascadeClassifier, Mat, RectVector } from 'mirada/dist/src/types/opencv/_types';

const hdConstraints = {
  video: {width: {exact: 1280}, height: {exact: 720}}
};

export enum ResolutionOptionType {
  AUTO,
  MAXIMUM,
  NEAREST,
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

const loadOpenCV = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if OpenCV is already loaded
    if (window.cv && window.cv['onRuntimeInitialized']) {
      resolve(); // OpenCV already loaded
    } else {
      // Check if the script is already in the document
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://docs.opencv.org/3.4/opencv.js"]'
      );
      if (existingScript) {
        // If it exists, wait for it to initialize
        existingScript.onload = () => resolve();
        existingScript.onerror = () =>
          reject(new Error('Failed to load OpenCV.js'));
      } else {
        // Create and append the script
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/3.4/opencv.js';
        script.async = true;
        script.onload = () => {
          // Resolve when OpenCV is initialized
          if (window.cv && window.cv['onRuntimeInitialized']) {
            resolve();
          } else {
            reject(new Error('OpenCV did not initialize correctly.'));
          }
        };
        script.onerror = () => {
          reject(new Error('Failed to load OpenCV.js'));
        };

        // Append the script to the head
        document.head.appendChild(script);
      }
    }
  });
};

export function AutoCropId() {
  const [currentDeviceInfo, setCurrentDeviceInfo] = useState<DeviceInfo | null>(
    null
  );
  const [factor_, setFactor] = useState<number>(0.25);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[] | null>(null);
  const [processedImageInfo, setProcessedImageInfo] = useState<{
    width: number;
    height: number;
    size: number;
  } | null>(null);
  const [opencvReady, setOpencvReady] = useState<boolean>(false);
  const [status, setStatus] = useState('');
  const [imageSize, setImageSize] = useState<number | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<{
    width?: number;
    height?: number;
  }>();

  const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const devicesNew = mediaDevices.filter(({ kind }) => kind === 'videoinput');
    setDevices(devicesNew);
  }, []);

  useEffect(() => {
    // Load OpenCV.js and run the detection once OpenCV is ready
    loadOpenCV()
      .then(() => {
        setOpencvReady(true);
        console.log('OpenCV.js loaded.');
        setStatus('Camera ready.');
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  const getCurrentDeviceInfo = async (
    deviceId: string,
    imageCaptureResolution: ImageCaptureResolutionHint
  ): Promise<DeviceInfo | undefined> => {
    const deviceInfo: DeviceInfo = {
      deviceId: deviceId,
      video: {},
    };

    const constraints: MediaStreamConstraints = {
      audio: false,
    };

    switch (imageCaptureResolution.type) {
      case ResolutionOptionType.MAXIMUM:
        constraints.video = {
          deviceId: deviceId,
          width: { ideal: 4096 },
          height: { ideal: 2160 },
        };
        break;
      case ResolutionOptionType.NEAREST:
        constraints.video = {
          deviceId: deviceId,
          width: { ideal: imageCaptureResolution.width },
          height: { ideal: imageCaptureResolution.height },
        };
        break;
      case ResolutionOptionType.AUTO:
        constraints.video = {
          deviceId: deviceId,
        };
        break;
    }

    console.log('Getting user media with constraints:', constraints);

    return navigator.mediaDevices
      .getUserMedia(hdConstraints)
      .then((stream) => {
        const videoTracks = stream.getVideoTracks();
        console.log('Got video tracks:', videoTracks);
        if (videoTracks.length > 0) {
          const videoTrack = videoTracks[0];

          const videoTrackSettings = videoTrack.getSettings();

          console.log('Video track settings:', videoTrackSettings);
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

          stream.getTracks().forEach((track) => track.stop());
        }

        return deviceInfo;
      })
      .catch(() => {
        console.error('Error getting user media');
        return undefined;
      });
  };

  const getVideoConstraints = (
    deviceInfo: DeviceInfo
  ): MediaTrackConstraints => {
    const videoConstraints = {
      deviceId: deviceInfo.deviceId,
    } as MediaTrackConstraints;

    if (deviceInfo.video.captureResolution) {
      videoConstraints.width = {
        ideal: deviceInfo.video.captureResolution.width,
      };
      videoConstraints.height = {
        ideal: deviceInfo.video.captureResolution.height,
      };
    }

    console.log('Video constraints:', videoConstraints);

    return videoConstraints;
  };

  const getWebcamProps = (): WebcamProps => {
    const isFacingUser = !!currentDeviceInfo?.video?.isFacingUser;

    const webCamProps: WebcamProps = {
      audio: false,
      forceScreenshotSourceSize: false,
      imageSmoothing: false,
      mirrored: isFacingUser,
      screenshotFormat: 'image/jpeg',
      disablePictureInPicture: true,
      videoConstraints: currentDeviceInfo
        ? getVideoConstraints(currentDeviceInfo)
        : {},
      onUserMedia: (stream) => {
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0];
          const { width, height } = videoTrack.getSettings();

          setResolution({ width, height });
        }
      },
      onUserMediaError: () => {
        // this shouldn't happen if onDeviceAccessDenied is passed in and handled correctly
      },
      screenshotQuality: 1,
    };

    return webCamProps;
  };

  // Capture image and hide webcam for preview
  const capture = useCallback((webcamRef: React.RefObject<Webcam>) => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      processImage(imageSrc, factor_);
      const imageSize = calculateBase64ImageSize(imageSrc);
      setImageSize(imageSize);
    }
  }, [factor_]);

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
        setStatus('Processing image...');
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        faces = new cv.RectVector();
        faceCascade = new cv.CascadeClassifier();

        // Fetch Haar Cascade file and load it into OpenCV
        const response = await fetch('/haarcascade_frontalface_default.xml');
        const xmlText = await response.text();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        cv.FS_createDataFile(
          '/',
          'haarcascade_frontalface_default.xml',
          xmlText,
          true,
          true
        );
        faceCascade.load('/haarcascade_frontalface_default.xml');

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

        console.log('Rendering output image...');
        const dst = src.roi(rect);

        console.log(
          'Source File dimension: ' + src.size().width + 'x' + src.size().height
        );
        console.log(
          'Destination File dimension: ' +
            dst.size().width +
            'x' +
            dst.size().height
        );

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
          setProcessedImage(processedImageSrc);

          const sizeInBytes = calculateBase64ImageSize(processedImageSrc);
          const sizeInKB = sizeInBytes / 1024;
          setProcessedImageInfo({
            width: processedCanvas.width,
            height: processedCanvas.height,
            size: sizeInKB,
          });
        }

        setStatus('Face detected and cropped.');
        // setHasFace(true);
      } catch (e) {
        console.error(e);
        setStatus((e as Error).message);
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

  const calculateBase64ImageSize = (base64String: string): number => {
    const stringLength = base64String.length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;
    return sizeInBytes; // Size in bytes
  };

  // Retry capturing by showing webcam again
  const retryCapture = () => {
    setCapturedImage(null);
    setProcessedImage(null);
    setProcessedImageInfo(null);
    setStatus('');
    window.location.reload();
  };

  useEffect(() => {
    if (devices) {
      setCurrentDeviceInfo(null);
      if (devices.length > 0) {
        const deviceId = devices[0].deviceId;
        getCurrentDeviceInfo(deviceId, {
          type: ResolutionOptionType.MAXIMUM,
        }).then((currentDeviceInfoNew) => {
          console.log('Current device info:', currentDeviceInfoNew);
          if (currentDeviceInfoNew) {
            setCurrentDeviceInfo(currentDeviceInfoNew);
          }
        });
      } else {
        console.error('No video devices found');
      }
    }
  }, [devices]);

  const webcamRef = React.useRef<Webcam>(null);

  console.log('OpenCV ready:', opencvReady);

  return (
    <div className='w-full px-3 md:w-[1440px] mx-auto'>
      <h1 className='my-6 text-2xl font-bold'>
        Automatically crop photo suitable for an ID card based on the subjects
        face.
      </h1>
      <p>Status: {status}</p>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {capturedImage ? (
        <div>
          <h3 className='mb-2 font-bold uppercase'>Preview</h3>
          <div className='flex flex-col gap-4 md:flex-row'>
            <div>
              <h4 className='mb-2 underline'>Original Image</h4>
              <img
                src={capturedImage}
                alt='Captured'
                style={{ maxWidth: '100%' }}
              />
              {imageSize && <p>Size: {(imageSize / 1024).toFixed(2)} KB</p>}
            </div>
            <div>
              <h4 className='mb-2 underline'>Processed Image</h4>
              {processedImage ? (
                <img
                  src={processedImage}
                  alt='Processed'
                  style={{ maxWidth: '100%' }}
                />
              ) : (
                <>
                  {/* sad emoji */}
                  {status === 'No faces detected' ? (
                    <p className='text-red-500'>
                      No faces detected in the image. Please try again.
                    </p>
                  ) : (
                    <p>Processing image...</p>
                  )}
                </>
              )}
              {processedImageInfo && (
                <div>
                  <p>
                    Dimensions: {processedImageInfo.width} x{' '}
                    {processedImageInfo.height}
                  </p>
                  <p>Size: {processedImageInfo.size.toFixed(2)} KB</p>
                </div>
              )}
            </div>
          </div>
          <br />

          <button
            onClick={retryCapture}
            className='inline-flex items-center justify-center h-12 gap-2 px-6 text-sm font-medium tracking-wide transition duration-300 border rounded focus-visible:outline-none whitespace-nowrap border-emerald-500 text-emerald-500 hover:border-emerald-600 hover:text-emerald-600 focus:border-emerald-700 focus:text-emerald-700 disabled:cursor-not-allowed disabled:border-emerald-300 disabled:text-emerald-300 disabled:shadow-none'
          >
            <span>Retry</span>
          </button>
        </div>
      ) : (
        <div>
          {resolution && (
            <p>Resolution: {`${resolution.width}x${resolution.height}`}</p>
          )}
          <Webcam poster={Poster} ref={webcamRef} {...getWebcamProps()} />
          <br />
         <div className='mb-3 w-52'>
         <p>{`Factor: ${factor_}`}</p>
         <Slider defaultValue={0.25} onChange={val => {
          setFactor(val as number)}} min={0} step={0.05} max={1} />
         </div>
          <button
            onClick={() => capture(webcamRef)}
            className='inline-flex items-center justify-center h-12 gap-2 px-6 text-sm font-medium tracking-wide text-white transition duration-300 rounded whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 focus:bg-emerald-700 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-emerald-300 disabled:bg-emerald-300 disabled:shadow-none'
          >
            <span>Capture Image</span>
          </button>
        </div>
      )}
    </div>
  );
}
