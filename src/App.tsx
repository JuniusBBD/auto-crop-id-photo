import React from 'react';
import { SelfieCamera } from './SelfieCamera';

function App() {
  const [screenshot, setScreenshot] = React.useState<string>();
  const [key, setKey] = React.useState<number>(0); // A key to force re-mounting the child

  const handleRetake = () => {
    setKey((prevKey) => prevKey + 1); // Change key to re-mount the VideoCapture component
  };

  return (
    <>
      {/* <AutoCropId /> */}
      <SelfieCamera
        key={key}
        screenshot={screenshot}
        setScreenshot={setScreenshot}
      />
      <div className='mx-5'>
        <button
          onClick={() => {
            setScreenshot('');
            handleRetake();
          }}
          className='w-full px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700'
        >
          Retake
        </button>
      </div>
    </>
  );
}

export default App;
