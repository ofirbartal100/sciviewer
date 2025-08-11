#!/usr/bin/env python3
"""
SciViewer Auto-Injection Demo Script

This script demonstrates the automatic injection capabilities of SciViewer.
When you open this file in VS Code with the SciViewer extension installed,
the matplotlib plots will automatically appear in the SciViewer panel.

No manual setup required! 🎉
"""

import matplotlib.pyplot as plt
import numpy as np
import time

def demo_basic_plot():
    """Create a basic line plot"""
    print("📊 Creating basic line plot...")
    
    x = np.linspace(0, 10, 100)
    y = np.sin(x)
    
    plt.figure(figsize=(10, 6))
    plt.plot(x, y, 'b-', linewidth=2, label='sin(x)')
    plt.title('Basic Line Plot - Auto-injected by SciViewer')
    plt.xlabel('X values')
    plt.ylabel('Y values')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.show()  # This will automatically save to SciViewer!

def demo_subplot():
    """Create subplots"""
    print("📊 Creating subplot demonstration...")
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
    
    # Left subplot
    x = np.linspace(0, 2*np.pi, 100)
    ax1.plot(x, np.sin(x), 'r-', label='sin(x)')
    ax1.plot(x, np.cos(x), 'b-', label='cos(x)')
    ax1.set_title('Trigonometric Functions')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Right subplot
    data = np.random.randn(1000)
    ax2.hist(data, bins=50, alpha=0.7, color='green')
    ax2.set_title('Random Data Histogram')
    ax2.set_xlabel('Value')
    ax2.set_ylabel('Frequency')
    
    plt.tight_layout()
    plt.show()  # Auto-injected!

def demo_scatter_plot():
    """Create a scatter plot with color mapping"""
    print("📊 Creating scatter plot with color mapping...")
    
    # Generate random data
    n_points = 200
    x = np.random.randn(n_points)
    y = np.random.randn(n_points)
    colors = np.sqrt(x**2 + y**2)  # Distance from origin
    
    plt.figure(figsize=(8, 8))
    scatter = plt.scatter(x, y, c=colors, alpha=0.6, cmap='viridis', s=50)
    plt.colorbar(scatter, label='Distance from Origin')
    plt.title('Scatter Plot with Color Mapping')
    plt.xlabel('X values')
    plt.ylabel('Y values')
    plt.grid(True, alpha=0.3)
    plt.show()  # Auto-injected!

def demo_3d_plot():
    """Create a 3D surface plot"""
    print("📊 Creating 3D surface plot...")
    
    from mpl_toolkits.mplot3d import Axes3D
    
    # Create data
    x = np.linspace(-5, 5, 50)
    y = np.linspace(-5, 5, 50)
    X, Y = np.meshgrid(x, y)
    Z = np.sin(np.sqrt(X**2 + Y**2))
    
    fig = plt.figure(figsize=(10, 8))
    ax = fig.add_subplot(111, projection='3d')
    
    surf = ax.plot_surface(X, Y, Z, cmap='coolwarm', alpha=0.8)
    ax.set_title('3D Surface Plot - Automatically Captured')
    ax.set_xlabel('X axis')
    ax.set_ylabel('Y axis')
    ax.set_zlabel('Z axis')
    
    fig.colorbar(surf, shrink=0.5, aspect=5)
    plt.show()  # Auto-injected!

def demo_animation_frames():
    """Create multiple plots simulating animation frames"""
    print("📊 Creating animation frames...")
    
    for i in range(5):
        plt.figure(figsize=(8, 6))
        
        x = np.linspace(0, 4*np.pi, 100)
        y = np.sin(x + i * np.pi/4)
        
        plt.plot(x, y, 'b-', linewidth=3)
        plt.title(f'Animation Frame {i+1}/5 - Phase: {i*45}°')
        plt.xlabel('X values')
        plt.ylabel('sin(x + phase)')
        plt.ylim(-1.5, 1.5)
        plt.grid(True, alpha=0.3)
        
        plt.show()  # Each frame auto-injected!
        
        print(f"   Frame {i+1} captured!")
        time.sleep(0.5)  # Small delay to see the progression

def main():
    """Run all demo functions"""
    print("🚀 SciViewer Auto-Injection Demo Starting!")
    print("=" * 50)
    print("Watch the SciViewer panel as plots appear automatically!")
    print("=" * 50)
    
    # Run demos with small delays
    demo_basic_plot()
    time.sleep(1)
    
    demo_subplot()
    time.sleep(1)
    
    demo_scatter_plot()
    time.sleep(1)
    
    demo_3d_plot()
    time.sleep(1)
    
    demo_animation_frames()
    
    print("=" * 50)
    print("🎉 Demo completed! Check your SciViewer panel.")
    print("All plots were automatically captured without any manual setup!")
    print("=" * 50)

if __name__ == "__main__":
    main()
