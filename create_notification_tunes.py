#!/usr/bin/env python3
"""
Notification Tune Generator
Creates looped versions of a notification sound for iOS (WAV) and Android (MP3).
"""

import os
from pathlib import Path
from pydub import AudioSegment


def create_looped_audio(audio: AudioSegment, loop_count: int, gap_ms: int = 1000) -> AudioSegment:
    """
    Creates a looped version of the audio with silence gaps between loops.
    
    Args:
        audio: The original audio segment
        loop_count: Number of times to loop the audio
        gap_ms: Milliseconds of silence between loops (default: 500ms)
    
    Returns:
        AudioSegment with the audio looped the specified number of times
    """
    if loop_count <= 1:
        return audio
    
    # Create silence gap with same audio properties
    silence = AudioSegment.silent(
        duration=gap_ms,
        frame_rate=audio.frame_rate
    )
    
    # Start with the first segment
    result = audio
    
    # Loop and append with silence gap between
    for _ in range(loop_count - 1):
        # Add silence gap, then the next loop
        result = result + silence + audio
    
    return result


def create_notification_tunes(input_file: str, output_base_dir: str = "tunes"):
    """
    Creates looped notification tunes from an input audio file.
    
    Args:
        input_file: Path to the original 3-second notification sound
        output_base_dir: Base directory for output files
    """
    # Verify input file exists
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file not found: {input_file}")
    
    # Load the original audio
    print(f"Loading audio from: {input_file}")
    original = AudioSegment.from_file(input_file)
    
    # Print audio info
    duration_sec = len(original) / 1000
    print(f"Original duration: {duration_sec:.2f} seconds")
    print(f"Channels: {original.channels}")
    print(f"Sample rate: {original.frame_rate} Hz")
    print(f"Sample width: {original.sample_width * 8} bits")
    
    # Define loop configurations: (suffix, loop_count)
    configs = [
        ("3sec", 1),   # Original
        ("6sec", 2),   # Looped 2x
        ("12sec", 3),  # Looped 3x
    ]
    
    # Create output directories
    ios_dir = Path(output_base_dir) / "ios"
    android_dir = Path(output_base_dir) / "android"
    
    ios_dir.mkdir(parents=True, exist_ok=True)
    android_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\nCreating output directories:")
    print(f"  iOS: {ios_dir.absolute()}")
    print(f"  Android: {android_dir.absolute()}")
    
    # Process each configuration
    for suffix, loop_count in configs:
        print(f"\n--- Creating notification_{suffix} (looped {loop_count}x) ---")
        
        # Create looped audio
        if loop_count == 1:
            looped_audio = original
        else:
            looped_audio = create_looped_audio(original, loop_count)
        
        looped_duration = len(looped_audio) / 1000
        print(f"Duration: {looped_duration:.2f} seconds")
        
        # Export iOS version (WAV)
        ios_path = ios_dir / f"notification_{suffix}.wav"
        looped_audio.export(
            ios_path,
            format="wav",
            parameters=["-acodec", "pcm_s16le"]  # Standard PCM format for iOS
        )
        print(f"Saved iOS WAV: {ios_path}")
        
        # Export Android version (MP3)
        android_path = android_dir / f"notification_{suffix}.mp3"
        looped_audio.export(
            android_path,
            format="mp3",
            bitrate="192k",  # Good quality for notification sounds
            parameters=["-q:a", "2"]  # High quality VBR
        )
        print(f"Saved Android MP3: {android_path}")
    
    print("\n" + "=" * 50)
    print("✅ All notification tunes created successfully!")
    print("=" * 50)
    
    # Print summary
    print("\nOutput files:")
    print("\niOS (WAV files):")
    for wav_file in sorted(ios_dir.glob("*.wav")):
        size_kb = wav_file.stat().st_size / 1024
        print(f"  {wav_file.name}: {size_kb:.1f} KB")
    
    print("\nAndroid (MP3 files):")
    for mp3_file in sorted(android_dir.glob("*.mp3")):
        size_kb = mp3_file.stat().st_size / 1024
        print(f"  {mp3_file.name}: {size_kb:.1f} KB")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Create looped notification tunes from a source audio file"
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        default="tune.wav",
        help="Path to the input audio file (default: tune.wav)"
    )
    parser.add_argument(
        "-o", "--output-dir",
        default="tunes",
        help="Output directory for the generated files (default: tunes)"
    )
    
    args = parser.parse_args()
    
    try:
        create_notification_tunes(args.input_file, args.output_dir)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        exit(1)
    except Exception as e:
        print(f"Error processing audio: {e}")
        exit(1)
