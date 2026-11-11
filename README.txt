FACE MODEL FILES REQUIRED

This starter uses face-api.js. Download the following model weight files from the face-api.js weights repository and place them directly in this folder:
- ssd_mobilenetv1_model-weights_manifest.json and its shard file(s)
- face_landmark_68_model-weights_manifest.json and its shard file(s)
- face_recognition_model-weights_manifest.json and its shard file(s)

Use the official face-api.js weights repository:
https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Keep the JSON manifests and shard files in /public/models. Without these files, face search and face indexing will show a model-loading error. The normal photo upload and text search still work.
