export type UploadState = {
  uploading: boolean;
  done: boolean;
  failed: boolean;
  progress?: number;
  error?: string;
  url?: string;
};

export const initialUpload: UploadState = { uploading: false, done: false, failed: false };

export const finishUpload = (state: UploadState, url: string): UploadState => ({
  ...state,
  uploading: false,
  done: true,
  url,
});
