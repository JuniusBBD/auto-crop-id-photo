import React from 'react';
// import { AutoCropId } from './AutoCropId'
import { DeviceInfo, NewAutoCropId } from './NewAutoCropId';
import { SelfieCamera } from './SelfieCamera';

function App() {
  const [screenshot, setScreenshot] = React.useState<string>();
  const [cameraInfo, setCameraInfo] = React.useState<DeviceInfo | null>(null);
  const [retake, setRetake] = React.useState<boolean>(false);

  return (
    <>
      {/* <AutoCropId /> */}
      <SelfieCamera
        retake={retake}
        screenshot={screenshot}
        cameraInfo={cameraInfo}
        setCameraInfo={setCameraInfo}
        setScreenshot={setScreenshot}
      />
      <button
        onClick={() => {
          setScreenshot('');
          setRetake(true);
        }}
      >
        Reset
      </button>
    </>
  );
}

export default App;
