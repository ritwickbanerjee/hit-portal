'use client';

import { useCallback, useState } from 'react';
import { Upload, X, File, Image, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface UploadedFile {
    id: string;
    file: File;
    originalSize: number;
    compressedSize?: number;
    status: 'pending' | 'compressing' | 'ready' | 'error';
    error?: string;
    preview?: string;
}

interface FileUploadZoneProps {
    onFilesReady: (files: File[]) => void;
    maxFiles?: number;
    disabled?: boolean;
}

export default function FileUploadZone({ onFilesReady, maxFiles = 5, disabled = false }: FileUploadZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

    const compressImage = async (file: File): Promise<File> => {
        const options = {
            maxSizeMB: 10, // Max 10MB after compression
            maxWidthOrHeight: 4096,
            useWebWorker: true,
            fileType: file.type as any
        };

        try {
            const compressed = await imageCompression(file, options);
            return compressed;
        } catch (error) {
            console.error('Compression error:', error);
            return file; // Return original if compression fails
        }
    };

    const processFile = useCallback(async (file: File) => {
        const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const uploadedFile: UploadedFile = {
            id: fileId,
            file,
            originalSize: file.size,
            status: 'pending'
        };

        setUploadedFiles(prev => [...prev, uploadedFile]);

        // Compress images
        if (file.type.startsWith('image/')) {
            setUploadedFiles(prev => prev.map(f =>
                f.id === fileId ? { ...f, status: 'compressing' as const } : f
            ));

            try {
                const compressed = await compressImage(file);

                setUploadedFiles(prev => prev.map(f =>
                    f.id === fileId ? {
                        ...f,
                        file: compressed,
                        compressedSize: compressed.size,
                        status: 'ready' as const
                    } : f
                ));
            } catch (error: any) {
                setUploadedFiles(prev => prev.map(f =>
                    f.id === fileId ? {
                        ...f,
                        status: 'error' as const,
                        error: 'Compression failed'
                    } : f
                ));
            }
        } else {
            // Non-image files are ready immediately
            setUploadedFiles(prev => prev.map(f =>
                f.id === fileId ? { ...f, status: 'ready' as const } : f
            ));
        }
    }, []);

    const handleFiles = useCallback((files: FileList | null) => {
        if (!files || disabled) return;

        const fileArray = Array.from(files);
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

        const validFiles = fileArray.filter(file => {
            if (!validTypes.includes(file.type)) {
                alert(`Invalid file type: ${file.name}. Allowed: PDF, PNG, JPG, DOCX`);
                return false;
            }
            if (file.size > 50 * 1024 * 1024) {
                alert(`File too large: ${file.name}. Max 50MB.`);
                return false;
            }
            return true;
        });

        if (uploadedFiles.length + validFiles.length > maxFiles) {
            alert(`Maximum ${maxFiles} files allowed`);
            return;
        }

        validFiles.forEach(processFile);
    }, [uploadedFiles.length, maxFiles, processFile, disabled]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const removeFile = (id: string) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== id));
    };

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <Image className="h-5 w-5" />;
        if (type === 'application/pdf') return <FileText className="h-5 w-5" />;
        return <File className="h-5 w-5" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleUpload = () => {
        const readyFiles = uploadedFiles.filter(f => f.status === 'ready').map(f => f.file);
        if (readyFiles.length > 0) {
            onFilesReady(readyFiles);
        }
    };

    const readyCount = uploadedFiles.filter(f => f.status === 'ready').length;

    const totalOriginalSize = uploadedFiles.reduce((acc, f) => acc + f.originalSize, 0);
    const totalCompressedSize = uploadedFiles.reduce((acc, f) => acc + (f.compressedSize || f.originalSize), 0);
    const totalSaved = totalOriginalSize - totalCompressedSize;

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
            >
                <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.docx"
                    onChange={(e) => handleFiles(e.target.files)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={disabled}
                />

                <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-blue-400' : 'text-gray-400'}`} />
                <p className="text-white font-medium mb-1">
                    {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
                </p>
                <p className="text-sm text-gray-400">
                    Supported: PDF, PNG, JPG • Max {maxFiles} files • 50MB each
                </p>
                <p className="text-xs text-gray-500 mt-2">
                    Images will be automatically compressed for faster processing
                </p>
            </div>

            {/* File List */}
            {uploadedFiles.length > 0 && (
                <div className="space-y-3">
                    {/* Batch Summary & Actions */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5">Total Size</p>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-lg font-bold ${totalCompressedSize > 10 * 1024 * 1024 ? 'text-yellow-400' : 'text-white'}`}>
                                        {formatFileSize(totalCompressedSize)}
                                    </span>
                                    {totalSaved > 0 && (
                                        <span className="text-green-400 text-xs">
                                            ({formatFileSize(totalSaved)} saved)
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="h-8 w-px bg-gray-700 hidden sm:block"></div>
                            <div className="hidden sm:block">
                                <p className="text-xs text-gray-400">
                                    {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} • {readyCount} ready
                                </p>
                            </div>
                        </div>

                        {readyCount > 0 && (
                            <button
                                onClick={handleUpload}
                                className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded shadow-lg text-sm font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95"
                                disabled={disabled}
                            >
                                <Upload className="h-4 w-4" />
                                Extract Questions
                            </button>
                        )}
                    </div>


                    {uploadedFiles.map(file => (
                        <div
                            key={file.id}
                            className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center gap-3"
                        >
                            <div className="text-gray-400">
                                {getFileIcon(file.file.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">
                                    {file.file.name}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <span>{formatFileSize(file.originalSize)}</span>
                                    {file.compressedSize && file.compressedSize < file.originalSize && (
                                        <span className="text-green-400">
                                            → {formatFileSize(file.compressedSize)} ({Math.round((1 - file.compressedSize / file.originalSize) * 100)}% saved)
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {file.status === 'compressing' && (
                                    <div className="flex items-center gap-2 text-blue-400 text-xs">
                                        <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                                        Compressing...
                                    </div>
                                )}
                                {file.status === 'ready' && (
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                )}
                                {file.status === 'error' && (
                                    <div className="flex items-center gap-2 text-red-400 text-xs">
                                        <AlertCircle className="h-4 w-4" />
                                        {file.error}
                                    </div>
                                )}

                                <button
                                    onClick={() => removeFile(file.id)}
                                    className="text-gray-400 hover:text-red-400 transition-colors"
                                    disabled={disabled}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
