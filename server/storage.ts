import { randomUUID } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const bucket = process.env.OBJECT_STORAGE_BUCKET
const client = bucket ? new S3Client({
  region: process.env.OBJECT_STORAGE_REGION ?? 'auto',
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? '',
  },
}) : null

export function storageConfigured() { return Boolean(client && bucket) }

export async function uploadFile(userId: string, kind: 'audio' | 'resume', file: Express.Multer.File) {
  if (!client || !bucket) throw new Error('Private object storage is not configured')
  const extension = file.originalname.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  const key = `${kind}/${userId}/${randomUUID()}.${extension}`
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }))
  return key
}

export async function readFile(key: string) {
  if (!client || !bucket) throw new Error('Private object storage is not configured')
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
}
