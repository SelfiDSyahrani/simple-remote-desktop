# Simple Remote Desktop
WebRTC Implementation 

## Prerequisite
Please make sure you have libvpx installed on your system, as it’s used for encoding to the VP8 format. 

### Installation `libvpx` commands:
- Debian/Ubuntu: `sudo apt-get install libvpx-dev`
- CentOS/Fedora/RHEL: `sudo yum install libvpx-devel`
- macOS (using Homebrew): `brew install libvpx`


### **Instalation `libvpx` on Windows System**

To install **libvpx** on Windows, you can use the following steps. This process may vary depending on your development environment, but here’s a general guide:

#### 1. **Install MSYS2**:
   - Download and install [MSYS2](https://www.msys2.org/), which provides a set of tools for compiling libraries and applications on Windows.
   - After installing, open the MSYS2 terminal and update the package list:
     ```bash
     pacman -Syu
     ```

#### 2. **Install Dependencies**:
   - You may need `gcc`, `make`, `yasm`, and other tools for building **libvpx**. Install these packages using MSYS2:
     ```bash
     pacman -S base-devel mingw-w64-x86_64-toolchain mingw-w64-x86_64-yasm
     ```

#### 3. **Download and Build libvpx**:
   - Go to the [libvpx GitHub repository](https://github.com/webmproject/libvpx) and download the latest source code, or clone it directly:
     ```bash
     git clone https://github.com/webmproject/libvpx.git
     cd libvpx
     ```

   - Run the configuration and build commands for **libvpx**. Use MSYS2's `mingw-w64` environment to ensure compatibility with Windows:
     ```bash
     ./configure --target=x86_64-win64-gcc
     make
     ```

After these steps, you should be able to build and link **libvpx** in your Go project on Windows.


## **How to Run the Program**

### 1. Run the WebSocket Server
   ```bash
   node websocket-server.js
   ```

### 2. Run the Golang Program
   ```bash
   go run main.go
   ```

### 3. Open in Browser
   Open `localhost:5000` in your browser.