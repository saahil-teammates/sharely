'use client'
import React, { useState, useRef, useCallback } from 'react';
import { Play, Square, Download, Mic, Monitor, RefreshCw } from 'lucide-react';

const Home = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready to record');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startRecording = useCallback(async () => {
    try {
      setError('');
      setStatus('Checking compatibility...');

      // Check if APIs are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen recording is not supported in this browser. Please use Chrome, Edge, or Firefox.');
      }

      // Check if we're in a secure context
      if (!window.isSecureContext) {
        throw new Error('Screen recording requires HTTPS or localhost. Please access this page over HTTPS.');
      }

      setStatus('Requesting permissions...');

      // Get screen capture with audio
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Get microphone audio
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // Create audio context to mix audio streams
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add screen audio if available
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        const screenSource = audioContext.createMediaStreamSource(
          new MediaStream([screenAudioTracks[0]])
        );
        screenSource.connect(destination);
      }

      // Add microphone audio
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(destination);

      // Combine video from screen and mixed audio
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      // Setup MediaRecorder
      recordedChunks.current = [];
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, {
          type: 'video/webm'
        });
        setRecordedBlob(blob);
        setStatus('Recording completed');

        // Clean up streams
        screenStream.getTracks().forEach(track => track.stop());
        micStream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      // Handle screen share stop
      screenStream.getVideoTracks()[0].onended = () => {
        if (isRecording) {
          stopRecording();
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setStatus('Recording in progress...');

    } catch (err: unknown) {
      console.error('Error starting recording:', err);
      setError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStatus('Ready to record');
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const downloadRecording = useCallback(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `screen-recording-${new Date().toISOString().slice(0, 19)}.webm`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  }, [recordedBlob]);

  const resetRecording = useCallback(() => {
    setRecordedBlob(null);
    setPreviewUrl(null);
    setStatus('Ready to record');
    setError('');
  }, []);

  // Update preview URL when recordedBlob changes
  React.useEffect(() => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [recordedBlob]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Screen + Audio Recorder
          </h1>
          <p className="text-lg text-gray-600">
            Record your screen with both system audio and microphone
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Preview Section */}
          {previewUrl && (
            <div className="p-4 bg-gray-900">
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                className="w-full rounded-lg"
                style={{ maxHeight: '60vh' }}
              />
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-full">
                  <Monitor className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700">Screen</span>
                </div>
                <div className="flex items-center space-x-2 bg-green-50 px-4 py-2 rounded-full">
                  <Mic className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700">Microphone</span>
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${isRecording
                ? 'bg-red-100 text-red-700'
                : recordedBlob
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
                }`}>
                {isRecording && (
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                )}
                {status}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-center space-x-4">
              {!isRecording && !recordedBlob && (
                <button
                  onClick={startRecording}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  <Play className="w-5 h-5" />
                  <span>Start Recording</span>
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  <Square className="w-5 h-5" />
                  <span>Stop Recording</span>
                </button>
              )}

              {recordedBlob && (
                <div className="flex space-x-4">
                  <button
                    onClick={downloadRecording}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={resetRecording}
                    className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>New Recording</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;