import FileUploader from '../components/FileUploader';

export default function UploadPage() {
  return (
    <div className="stack">
      <h2>Upload statements</h2>
      <p>CSV is preferred. PDF is accepted and marked for review when parsing confidence is lower.</p>
      <FileUploader />
    </div>
  );
}
