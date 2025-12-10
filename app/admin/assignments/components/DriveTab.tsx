'use client';

import { useState, useEffect } from 'react';
import { Loader2, Copy, Check, ExternalLink, Save, Link as LinkIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DriveTab({ user, isGlobalAdmin }: { user: any; isGlobalAdmin: boolean }) {
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<any>(null);
    const [driveUrl, setDriveUrl] = useState('');
    const [scriptUrl, setScriptUrl] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [step, setStep] = useState(0); // 0: Status, 1: Link, 2: Deploy

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            const headers: any = { 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const fcRes = await fetch('/api/admin/faculty-configs', {
                headers
            });
            if (fcRes.ok) {
                const configs = await fcRes.json();
                const myConfig = configs.find((c: any) => c.facultyName === user.name);
                if (myConfig) {
                    setConfig(myConfig);
                    setDriveUrl(`https://drive.google.com/drive/folders/${myConfig.rootFolderId}`);
                    setScriptUrl(myConfig.scriptUrl || '');
                }
            }
        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            setLoading(false);
        }
    };

    const generateGAS = (id: string) => {
        const code = `
const ROOT_FOLDER_ID = "${id}";

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ready', message: 'Upload endpoint is ready' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .withHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Plain-Text',
      'Access-Control-Max-Age': '86400'
    });
}

function doPost(e) {
  var result = {};
  
  try {
    var payload = e.postData.contents;
    var data = JSON.parse(payload);
    var fileData = data.fileData.split(',')[1] || data.fileData; 
    var decodedData = Utilities.base64Decode(fileData);
    var blob = Utilities.newBlob(decodedData, MimeType.PDF, data.fileName);
    var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var finalFolder = getOrCreateFolder(rootFolder, data.folderPath);
    var file = finalFolder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (permErr) {}
    result = { status: 'success', driveLink: file.getUrl() };
  } catch (error) {
    result = { status: 'error', message: error.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(base, path) {
  var parts = path.split('/');
  var current = base;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    var f = current.getFoldersByName(p);
    if (f.hasNext()) current = f.next(); else current = current.createFolder(p);
  }
  return current;
}`;
        setGeneratedCode(code);
    };

    const handleGenerateCode = () => {
        const m = driveUrl.match(/[-\w]{25,}/);
        if (m) {
            generateGAS(m[0]);
            setStep(2);
            toast.success('Code generated');
        } else {
            toast.error('Invalid Drive URL');
        }
    };

    const handleSave = async () => {
        const id = driveUrl.match(/[-\w]{25,}/);
        if (!id || !scriptUrl) return toast.error('Missing Drive ID or Script URL');

        const toastId = toast.loading('Saving config...');
        try {
            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const res = await fetch('/api/admin/faculty-configs', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    facultyName: user.name,
                    rootFolderId: id[0],
                    scriptUrl: scriptUrl.trim()
                })
            });

            if (res.ok) {
                toast.success('Saved successfully', { id: toastId });
                fetchData();
                setStep(0);
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            toast.error('Error saving config', { id: toastId });
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(generatedCode);
        toast.success('Copied to clipboard');
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>;

    if (config && step === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in">
                <div className="bg-green-900/20 p-4 rounded-full border border-green-800">
                    <Check className="h-12 w-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white">Google Drive Linked</h2>
                <p className="text-gray-400 text-center max-w-md">
                    Your account is successfully linked to Google Drive. Assignments will be stored in your configured folder.
                </p>
                <div className="flex gap-4 mt-4">
                    <a href={`https://drive.google.com/drive/folders/${config.rootFolderId}`} target="_blank" className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                        <ExternalLink className="h-4 w-4" /> Open Drive Folder
                    </a>
                    <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-300 underline">
                        Re-configure
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-3xl animate-in fade-in duration-500 mx-auto">
            <div className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-2">Link Google Drive</h2>
                <p className="text-gray-400 mb-8">Connect your Google Drive to store student submissions automatically.</p>

                {/* Step 1: Link Folder */}
                {(step === 1 || !config) && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-blue-400 mb-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-900/50 border border-blue-800 font-bold">1</div>
                            <h3 className="text-lg font-medium">Link Folder</h3>
                        </div>

                        <div className="pl-12 space-y-4">
                            <ol className="list-decimal list-inside text-sm text-gray-400 space-y-2">
                                <li>Create a folder in Google Drive (e.g. "Submissions").</li>
                                <li>Open it, copy the URL from the address bar.</li>
                                <li>Paste it below and click "Generate Code".</li>
                            </ol>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={driveUrl}
                                    onChange={(e) => setDriveUrl(e.target.value)}
                                    placeholder="https://drive.google.com/drive/folders/..."
                                    className="block w-full rounded-md border-0 bg-gray-900/50 py-3 px-4 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                />
                                <button onClick={handleGenerateCode} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md text-sm font-semibold whitespace-nowrap shadow-lg shadow-blue-900/20">
                                    Generate Code
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Deploy Script */}
                {step >= 2 && (
                    <div className="space-y-6 mt-12 pt-8 border-t border-gray-700">
                        <div className="flex items-center gap-4 text-blue-400 mb-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-900/50 border border-blue-800 font-bold">2</div>
                            <h3 className="text-lg font-medium">Deploy Script</h3>
                        </div>

                        <div className="pl-12 space-y-6">
                            <div className="bg-gray-900 p-4 rounded border border-gray-700">
                                <p className="text-sm text-gray-400 mb-2">1. Go to <a href="https://script.google.com/home/start" target="_blank" className="text-blue-400 underline inline-flex items-center gap-1">script.google.com <ExternalLink className="h-3 w-3" /></a>, New Project.</p>
                                <p className="text-sm text-gray-400 mb-2">2. Paste this code into <code>Code.gs</code> (Replace everything).</p>
                                <div className="relative group">
                                    <textarea readOnly rows={14} value={generatedCode} className="w-full bg-black text-green-400 font-mono text-xs p-4 rounded border border-gray-800 focus:outline-none" />
                                    <button onClick={copyCode} className="absolute top-2 right-2 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Copy className="h-3 w-3" /> Copy
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-900 p-4 rounded border border-gray-700">
                                <p className="text-sm text-gray-400 mb-2 font-bold">3. Deploy (Crucial!)</p>
                                <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside mb-4">
                                    <li>Click <strong>Deploy</strong> -&gt; <strong>New Deployment</strong>.</li>
                                    <li>Select type: <strong>Web app</strong>.</li>
                                    <li>Execute as: <strong>Me</strong>.</li>
                                    <li>Who has access: <strong>Anyone</strong> (Vital for students to upload!).</li>
                                    <li>Click <strong>Deploy</strong>. Copy the <strong>Web App URL</strong> (ends in /exec).</li>
                                </ul>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Paste Web App URL here:</label>
                                <input
                                    type="text"
                                    value={scriptUrl}
                                    onChange={(e) => setScriptUrl(e.target.value)}
                                    placeholder="https://script.google.com/macros/s/.../exec"
                                    className="block w-full rounded-md border-0 bg-gray-900/50 py-3 px-4 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-lg font-bold shadow-lg shadow-green-900/20 flex justify-center items-center gap-2 transition-all hover:scale-[1.02]">
                                <Save className="h-5 w-5" /> Save Configuration
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
