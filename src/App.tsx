import React from 'react'
// import { AutoCropId } from './AutoCropId'
import { NewAutoCropId } from './NewAutoCropId'

function App() {

  const [screenshot, setScreenshot] = React.useState<string>()

  return (
    <>
      {/* <AutoCropId /> */}
      <NewAutoCropId screenshot={screenshot} setScreenshot={setScreenshot} />
      <button onClick={() => setScreenshot('')}>Reset</button>
    </>
  )
}

export default App
