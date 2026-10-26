"""
InsightFace Evaluation Script
Tests:
- Same person, exact photo
- Same person, different photo / crop / lighting
- Different persons
- Blank / non-face
- Multi-face
"""
import sys, os, urllib.request, io
import numpy as np
from PIL import Image, ImageEnhance
import insightface
from insightface.app import FaceAnalysis

print("=== EVALUATING INSIGHTFACE (ArcFace) ===")

app = FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# URLs of test faces
URL_PERSON1_A = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300"
URL_PERSON1_B = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300" # different person
URL_PERSON2_A = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300"

def download_img(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'CRMS-Eval/1.0'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')

print("\nDownloading test images...")
img1_a = download_img(URL_PERSON1_A)
img2_a = download_img(URL_PERSON2_A)

# Create variations of Person 1
# 1. Cropped
w, h = img1_a.size
img1_crop = img1_a.crop((int(w*0.05), int(h*0.05), int(w*0.95), int(h*0.95)))
# 2. Darkened / lighting change
img1_dark = ImageEnhance.Brightness(img1_a).enhance(0.7)
# 3. Contrast change
img1_contrast = ImageEnhance.Contrast(img1_a).enhance(1.3)

def get_face_embedding(pil_img):
    img_np = np.array(pil_img) # RGB
    # InsightFace expects BGR image (standard OpenCV format)
    img_bgr = img_np[:, :, ::-1]
    faces = app.get(img_bgr)
    if len(faces) == 0:
        return None, 0
    # largest face
    faces_sorted = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]), reverse=True)
    emb = faces_sorted[0].embedding # 512-dim float32
    norm = np.linalg.norm(emb)
    if norm > 0:
        emb = emb / norm
    return emb, len(faces)

def cosine_similarity(v1, v2):
    return float(np.dot(v1, v2))

def cosine_distance(v1, v2):
    return 1.0 - cosine_similarity(v1, v2)

emb1_a, count1_a = get_face_embedding(img1_a)
emb1_crop, count1_crop = get_face_embedding(img1_crop)
emb1_dark, count1_dark = get_face_embedding(img1_dark)
emb1_contrast, count1_contrast = get_face_embedding(img1_contrast)
emb2_a, count2_a = get_face_embedding(img2_a)

print(f"\nPerson 1 (Base) embedding shape: {emb1_a.shape}, norm: {np.linalg.norm(emb1_a):.4f}")
print(f"Person 1 (Crop) embedding shape: {emb1_crop.shape}")
print(f"Person 2 (Different) embedding shape: {emb2_a.shape}")

print("\n--- SIMILARITY COMPARISONS (Cosine Similarity [-1..1] and Cosine Distance [0..2]) ---")
print(f"1. Exact Same Photo:       sim = {cosine_similarity(emb1_a, emb1_a):.4f} | dist = {cosine_distance(emb1_a, emb1_a):.4f}")
print(f"2. Same Person (Cropped):   sim = {cosine_similarity(emb1_a, emb1_crop):.4f} | dist = {cosine_distance(emb1_a, emb1_crop):.4f}")
print(f"3. Same Person (Darkened):  sim = {cosine_similarity(emb1_a, emb1_dark):.4f} | dist = {cosine_distance(emb1_a, emb1_dark):.4f}")
print(f"4. Same Person (Contrast):  sim = {cosine_similarity(emb1_a, emb1_contrast):.4f} | dist = {cosine_distance(emb1_a, emb1_contrast):.4f}")
print(f"5. Different Person:        sim = {cosine_similarity(emb1_a, emb2_a):.4f} | dist = {cosine_distance(emb1_a, emb2_a):.4f}")

# Blank test
blank_img = Image.new('RGB', (300, 300), (200, 200, 200))
emb_blank, count_blank = get_face_embedding(blank_img)
print(f"\nBlank Image Faces Detected: {count_blank}")

# Multi-face test
multi_img = Image.new('RGB', (600, 300))
multi_img.paste(img1_a.resize((300, 300)), (0, 0))
multi_img.paste(img2_a.resize((300, 300)), (300, 0))
emb_multi, count_multi = get_face_embedding(multi_img)
print(f"Multi-face Image Faces Detected: {count_multi}")

print("\nDONE")
