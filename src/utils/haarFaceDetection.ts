import { loadDataFile } from './loadDataFile';

export async function loadHaarFaceModels() {
  try {
    console.log("=======start downloading Haar-cascade models=======");
    await loadDataFile(
      "haarcascade_frontalface_default.xml",
      "/haarcascade_frontalface_default.xml"
    );
    await loadDataFile("haarcascade_eye.xml", "/models/haarcascade_eye.xml");
    console.log("=======downloaded Haar-cascade models=======");
  } catch (error) {
    console.error(error);
  }
}