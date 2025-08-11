import tempfile
import matplotlib.pyplot as plt
import matplotlib.figure
import os
import sys
import json
from datetime import datetime
import importlib.util
import traceback
import atexit

# Configuration constants
TEMP_DIR_NAME = 'sciviewer'
MAX_PLOTS_STORED = 100
METADATA_FILENAME = 'plot_metadata.json'

# Use the same custom temp directory
temp_dir = os.path.join(tempfile.gettempdir(), TEMP_DIR_NAME)

# Ensure the directory exists
if not os.path.exists(temp_dir):
    os.makedirs(temp_dir)

# Global metadata storage
plot_metadata = {}
metadata_file = os.path.join(temp_dir, METADATA_FILENAME)

def load_existing_metadata():
    """Load existing plot metadata from file"""
    global plot_metadata
    try:
        if os.path.exists(metadata_file):
            with open(metadata_file, 'r', encoding='utf-8') as f:
                plot_metadata = json.load(f)
    except Exception as e:
        print(f"Warning: Could not load SciViewer metadata: {e}")
        plot_metadata = {}

def save_metadata():
    """Save plot metadata to file"""
    try:
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(plot_metadata, f, indent=2, default=str)
    except Exception as e:
        print(f"Warning: Could not save SciViewer metadata: {e}")

def cleanup_old_plots():
    """Remove old plot files if we exceed the maximum number"""
    try:
        png_files = [f for f in os.listdir(temp_dir) if f.endswith('.png')]
        if len(png_files) > MAX_PLOTS_STORED:
            # Sort by modification time and remove oldest
            png_files_with_time = [(f, os.path.getmtime(os.path.join(temp_dir, f))) for f in png_files]
            png_files_with_time.sort(key=lambda x: x[1])
            
            files_to_remove = png_files_with_time[:-MAX_PLOTS_STORED]
            for filename, _ in files_to_remove:
                try:
                    os.remove(os.path.join(temp_dir, filename))
                    # Remove from metadata as well
                    plot_metadata.pop(filename, None)
                except Exception:
                    pass
    except Exception as e:
        print(f"Warning: Could not cleanup old plots: {e}")

def get_execution_context():
    """Get information about the current execution context"""
    context = {
        'script_path': None,
        'function_name': None,
        'line_number': None,
        'is_jupyter': False,
        'is_interactive': False
    }
    
    try:
        # Get the current frame to find calling context
        frame = sys._getframe()
        while frame:
            filename = frame.f_code.co_filename
            
            # Skip our own frames
            if 'monkey_patch' in filename or 'matplotlib' in filename:
                frame = frame.f_back
                continue
                
            context['script_path'] = filename
            context['function_name'] = frame.f_code.co_name
            context['line_number'] = frame.f_lineno
            
            # Detect Jupyter
            if 'ipykernel' in filename or 'IPython' in filename:
                context['is_jupyter'] = True
            
            # Detect interactive mode
            if filename == '<stdin>' or filename == '<console>':
                context['is_interactive'] = True
                
            break
            
    except Exception as e:
        print(f"Warning: Could not get execution context: {e}")
    
    return context

def create_plot_metadata(filename, figure=None):
    """Create metadata for a plot"""
    context = get_execution_context()
    
    metadata = {
        'filename': filename,
        'timestamp': datetime.now().isoformat(),
        'creation_time': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'context': context,
        'size_bytes': 0
    }
    
    # Add figure-specific metadata if available
    if figure:
        try:
            metadata['figure_size'] = figure.get_size_inches().tolist()
            metadata['dpi'] = figure.dpi
            
            # Get axes information
            axes_info = []
            for i, ax in enumerate(figure.axes):
                ax_info = {
                    'index': i,
                    'title': ax.get_title(),
                    'xlabel': ax.get_xlabel(),
                    'ylabel': ax.get_ylabel(),
                    'xlim': list(ax.get_xlim()),
                    'ylim': list(ax.get_ylim())
                }
                axes_info.append(ax_info)
            metadata['axes'] = axes_info
            
        except Exception as e:
            print(f"Warning: Could not extract figure metadata: {e}")
    
    return metadata

def enhanced_save_and_show(*args, **kwargs):
    """Enhanced version of plt.show() that saves plots with metadata"""
    try:
        # Generate unique filename with timestamp and microseconds
        timestamp = datetime.now()
        filename = f'plot_{timestamp.strftime("%Y%m%d_%H%M%S_%f")}.png'
        filepath = os.path.join(temp_dir, filename)
        
        # Get current figure
        fig = plt.gcf()
        
        # Save the plot with high quality
        plt.savefig(filepath, dpi=150, bbox_inches='tight', 
                   facecolor='white', edgecolor='none')
        
        # Create and store metadata
        metadata = create_plot_metadata(filename, fig)
        
        # Add file size after saving
        if os.path.exists(filepath):
            metadata['size_bytes'] = os.path.getsize(filepath)
        
        plot_metadata[filename] = metadata
        
        # Cleanup and save metadata
        cleanup_old_plots()
        save_metadata()
        
        print(f"📊 SciViewer: Plot saved to {filename}")
        
    except Exception as e:
        print(f"❌ SciViewer: Error saving plot: {e}")
        traceback.print_exc()

def enhanced_figure_show(self, *args, **kwargs):
    """Enhanced version of Figure.show() that saves plots with metadata"""
    try:
        # Generate unique filename
        timestamp = datetime.now()
        filename = f'figure_{timestamp.strftime("%Y%m%d_%H%M%S_%f")}.png'
        filepath = os.path.join(temp_dir, filename)
        
        # Save the figure with high quality
        self.savefig(filepath, dpi=150, bbox_inches='tight',
                    facecolor='white', edgecolor='none')
        
        # Create and store metadata
        metadata = create_plot_metadata(filename, self)
        
        # Add file size after saving
        if os.path.exists(filepath):
            metadata['size_bytes'] = os.path.getsize(filepath)
        
        plot_metadata[filename] = metadata
        
        # Cleanup and save metadata
        cleanup_old_plots()
        save_metadata()
        
        print(f"📊 SciViewer: Figure saved to {filename}")
        
    except Exception as e:
        print(f"❌ SciViewer: Error saving figure: {e}")
        traceback.print_exc()

# Load existing metadata
load_existing_metadata()

# Store original methods for potential restoration
_original_plt_show = plt.show
_original_figure_show = matplotlib.figure.Figure.show

# Override plt.show() and Figure.show()
plt.show = enhanced_save_and_show
matplotlib.figure.Figure.show = enhanced_figure_show

# Register cleanup function for graceful shutdown
atexit.register(save_metadata)

# Log successful patching with version info
print("✅ SciViewer: Enhanced matplotlib patch loaded successfully!")
print(f"   📁 Plots directory: {temp_dir}")
print(f"   📊 Active plots: {len([f for f in os.listdir(temp_dir) if f.endswith('.png')]) if os.path.exists(temp_dir) else 0}")
print(f"   ⚙️  Auto-cleanup enabled (max {MAX_PLOTS_STORED} plots)")