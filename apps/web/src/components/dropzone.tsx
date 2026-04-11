import { Button } from "@anchor/ui/components/button";
import { LucidePlus, UploadIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import Dropzone from "react-dropzone";

export const DropZoneTabExp = ({
  dzDisabled,
  onDropHandler,
  selectedFile,
  btnDisabled,
  buttonLabel,
}: {
  dzDisabled: boolean;
  onDropHandler: (acceptedFiles: File[]) => void;
  selectedFile: File | null;
  btnDisabled: boolean;
  buttonLabel: ReactNode;
}) => {
  const [fileEnter, setFileEntered] = useState(false);
  return (
    <div className="h-full w-full relative">
      <Dropzone
        accept={{ "application/pdf": [".pdf"] }}
        disabled={dzDisabled}
        onDrop={(acceptedFiles) => {
          setFileEntered(false);
          onDropHandler(acceptedFiles);
        }}
        onDragEnter={() => setFileEntered(true)}
        onDragLeave={() => setFileEntered(false)}
        onDragOver={() => setFileEntered(true)}
      >
        {({ getRootProps, getInputProps }) => (
          <section className="h-full w-full">
            <div className="w-40 h-full pointer-events-none"></div>
            <div
              {...getRootProps()}
              className={`border-2 absolute inset-0 flex bg-background items-center justify-center origin-top transition-transform ${
                fileEnter ? "size-40 scale-125" : "w-40 h-full scale-100"
              }`}
            >
              <input {...getInputProps()} />
              <LucidePlus size={25} />
            </div>
            {selectedFile && (
              <button
                type="submit"
                disabled={btnDisabled}
                className={
                  "w-full bg-white text-black rounded-b-lg flex items-center justify-center p-2"
                }
              >
                <UploadIcon />
              </button>
            )}
          </section>
        )}
      </Dropzone>
    </div>
  );
};
