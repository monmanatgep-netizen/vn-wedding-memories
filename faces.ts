"use client";

let faceApiPromise: Promise<any> | null = null;

async function faceApi() {
  if (!faceApiPromise) {
    faceApiPromise = import("face-api.js").then(async (mod: any) => {
      const api = mod.default || mod;
      const base = "/models";
      await Promise.all([
        api.nets.ssdMobilenetv1.loadFromUri(base),
        api.nets.faceLandmark68Net.loadFromUri(base),
        api.nets.faceRecognitionNet.loadFromUri(base)
      ]);
      return api;
    });
  }
  return faceApiPromise;
}

export async function getFaceDescriptors(file: File): Promise<number[][]> {
  const api = await faceApi();
  const url = URL.createObjectURL(file);
  try {
    const img = await api.fetchImage(url);
    const detections = await api.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
    return detections.map((d: any) => Array.from(d.descriptor as Float32Array));
  } finally {
    URL.revokeObjectURL(url);
  }
}
