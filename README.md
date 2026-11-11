# V&N Wedding Day's — Wedding Memories

A standalone Next.js + Supabase wedding photo guestbook starter.

## 1. Requirements
- macOS / Windows / Linux
- Node.js 20 LTS (recommended)
- A Supabase project
- A Vercel account for deployment (optional)

## 2. Install
1. Unzip the project.
2. Open Terminal and move into the project folder:
   `cd vn-wedding-memories`
3. Install packages:
   `npm install`
4. Copy `.env.example` to `.env.local`.
5. In Supabase > Project Settings > API, copy Project URL and anon/public key into `.env.local`.
6. In Supabase > SQL Editor, open `supabase/schema.sql`, paste the entire file and run it.
7. In Supabase > Storage, confirm the `wedding-photos` bucket exists.
8. Download the three face-api.js model sets described in `public/models/README.txt` and put their manifests and shard files into `public/models/`.
9. Start the app:
   `npm run dev`
10. Open `http://localhost:3000`.

## 3. Environment file
`.env.local` should look like:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_STORAGE_BUCKET=wedding-photos
```
Use the anon/public key only. NEVER put the Supabase service_role key in a browser-exposed `NEXT_PUBLIC_` variable.

## 4. Face search setup
The browser loads face-api.js models from `/public/models`. The three model groups are:
- SSD Mobilenet v1 face detector
- 68-point face landmarks
- Face recognition descriptor (128 dimensions)

When a guest checks the consent box, descriptors for detected faces in each uploaded image are stored in `face_embeddings`. Search runs against only opted-in photos. The reference image is analyzed in the browser and is not uploaded by this starter.

Important: Face recognition is biometric processing. Before public launch, publish a clear privacy notice, get affirmative consent, provide a contact for deletion requests, and set a retention/deletion schedule. Do not enable face search for guests who have not consented. This starter is a functional prototype foundation, not a legal compliance certification.

## 5. Test checklist
- Upload 1 image and confirm it appears in the gallery.
- Upload 4 images and confirm they receive sequential photo numbers.
- Search by guest name, wish text, and 4-digit photo number.
- Try face search using an image with one clear face.
- Confirm only opted-in photos appear in face results.
- Select multiple photos and download ZIP.
- Test on a phone and a desktop.

## 6. Deployment on Vercel
1. Push the project to a private GitHub repository.
2. In Vercel choose Add New > Project and import the repository.
3. Add the three environment variables from `.env.local` in Vercel Project Settings > Environment Variables.
4. Deploy.
5. Test upload and face search on the deployed URL.

## 7. Current starter limitations to address before a large public event
- The photo-number identity column is sequential but gaps can occur if a database insert fails; it guarantees uniqueness and monotonic allocation, not gap-free numbering. A strict gap-free sequence requires a serialized allocator and careful deletion policy.
- Public uploads have basic type/size limits but no CAPTCHA, per-IP rate limit, moderation queue, or abuse reporting. Add these before sharing widely.
- Face search uses browser-side model inference and a public RPC limited to opted-in records. Add server-side rate limiting, abuse monitoring, and a stricter consent/deletion workflow before production use.
- The current gallery reads all photos at once. For a large event, add pagination/infinite scrolling and thumbnail generation.
- Storage files are public-readable in this starter because the gallery is public. Do not upload private or sensitive photos unless all guests understand this.
- A database sequence can exceed 9999 if more than 9999 photos are uploaded; add a hard cap if the event requires a strict 0001–9999 limit.
