import numpy as np
import librosa
import scipy.signal

class AudioProcessor:
    """
    Base class for handling audio processing tasks including
    loading static audio files and processing real-time stream buffers.
    """
    
    def __init__(self, sample_rate=44100, buffer_size=2048):
        """
        Initialize the AudioProcessor.
        
        Args:
            sample_rate (int): The target sample rate for processing.
            buffer_size (int): The default size of buffers for stream processing.
        """
        self.sample_rate = sample_rate
        self.buffer_size = buffer_size
        self.stream_buffer = np.zeros(0, dtype=np.float32)

    def load_audio_file(self, file_path, sr=None):
        """
        Loads an audio file into a NumPy array.
        
        Args:
            file_path (str): Path to the audio file.
            sr (int, optional): Target sampling rate. If None, uses self.sample_rate.
        
        Returns:
            np.ndarray: The audio time series (mono).
            int: The sample rate of the loaded audio.
        """
        target_sr = sr if sr is not None else self.sample_rate
        audio_data, current_sr = librosa.load(file_path, sr=target_sr, mono=True)
        return audio_data, current_sr

    def ingest_stream_buffer(self, new_data):
        """
        Ingests a block of real-time audio data into the internal buffer.
        
        Args:
            new_data (np.ndarray): The new chunk of audio data.
        """
        # Ensure new_data is a 1D float32 numpy array
        new_data = np.asarray(new_data, dtype=np.float32).flatten()
        
        # Append to the stream buffer
        self.stream_buffer = np.concatenate((self.stream_buffer, new_data))

    def get_latest_buffer(self, size=None):
        """
        Retrieves the most recent block of audio data of specified size.
        If size is greater than available data, returns all available data.
        
        Args:
            size (int, optional): Number of samples to retrieve. Defaults to self.buffer_size.
            
        Returns:
            np.ndarray: The requested audio data.
        """
        req_size = size if size is not None else self.buffer_size

        if len(self.stream_buffer) < req_size:
            return self.stream_buffer.copy()
        
        return self.stream_buffer[-req_size:].copy()

    def clear_buffer(self):
        """
        Clears the internal stream buffer.
        """
        self.stream_buffer = np.zeros(0, dtype=np.float32)
