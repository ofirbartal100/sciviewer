import tempfile
import matplotlib.pyplot as plt
import matplotlib.figure
import os
import sys
from datetime import datetime
import importlib.util


# Use the same custom temp directory
temp_dir = os.path.join(tempfile.gettempdir(),'sciviewer')

# Ensure the directory exists
if not os.path.exists(temp_dir):
    os.makedirs(temp_dir)

def save_and_show():
    filename = os.path.join(temp_dir, f'plot_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png')
    plt.savefig(filename)

# Define a new Figure.show method
def patched_figure_show(self, *args, **kwargs):
    filename = os.path.join(temp_dir, f'figure_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.png')
    self.savefig(filename)

# Override plt.show() and Figure.show()
plt.show = save_and_show
matplotlib.figure.Figure.show = patched_figure_show

# Log successful patching
print("Successfully patched matplotlib.pyplot.show and matplotlib.figure.Figure.show")