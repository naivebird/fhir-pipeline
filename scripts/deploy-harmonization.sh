#!/bin/bash
set -e

# Deploy the harmonization service to Cloud Run

# Check required environment variables
if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID environment variable is required"
  exit 1
fi

REGION=${REGION:-us-west2}
SERVICE_NAME=${SERVICE_NAME:-fhir-harmonization}
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "Building and deploying harmonization service..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo "Image: $IMAGE_NAME"

# Build the container image
echo ""
echo "Building container image..."
gcloud builds submit \
  --project="$PROJECT_ID" \
  --config=cloudbuild-harmonization.yaml \
  .

# Update Cloud Run service with new image
echo ""
echo "Updating Cloud Run service..."
gcloud run services update "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE_NAME"

echo ""
echo "Deployment complete!"
echo "Service URL: $(gcloud run services describe $SERVICE_NAME --project=$PROJECT_ID --region=$REGION --format='value(status.url)')"
