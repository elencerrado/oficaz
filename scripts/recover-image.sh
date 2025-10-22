#!/bin/bash
# Script to recover a lost email marketing image
# Usage: ./scripts/recover-image.sh <path-to-image> <original-filename>

if [ $# -ne 2 ]; then
  echo "Usage: $0 <path-to-image> <original-filename>"
  echo "Example: $0 ~/Downloads/my-image.jpg email-1761038373158.jpg"
  exit 1
fi

IMAGE_PATH="$1"
FILENAME="$2"

if [ ! -f "$IMAGE_PATH" ]; then
  echo "Error: Image file not found: $IMAGE_PATH"
  exit 1
fi

echo "🔄 Recovering image: $FILENAME"
echo "📁 Source: $IMAGE_PATH"
echo ""

# Get super admin token from sessionStorage (you'll need to provide this)
read -p "Enter your SuperAdmin token: " TOKEN

# Upload the image with forced filename
curl -X POST "http://localhost:5000/api/super-admin/email-marketing/upload-image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@$IMAGE_PATH" \
  -F "width=600" \
  -F "forceFilename=$FILENAME"

echo ""
echo "✅ Done! Check the response above."
