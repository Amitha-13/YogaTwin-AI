# YogaTwin AI

## Digital Twin and AI-Powered Yoga Assistant System

YogaTwin AI is a web-based yoga assistance system designed to support yoga practice through real-time yoga asana pose estimation, posture analysis, and corrective feedback.

The system combines a React-based web application, computer-vision-based pose estimation, backend services, PostgreSQL database storage, and body-sensor data collection.

The project has two major user workflows:

- **Data Collection** – Used to collect and organize yoga practice data from video and body-sensor inputs.
- **Yoga Practice** – Used to perform yoga asanas while receiving pose-related information and corrective feedback.

---

# 1. Project Objective

The objective of YogaTwin AI is to develop a technology-assisted yoga practice system that can:

1. Allow users to access the yoga application through a web interface.
2. Collect structured yoga practice data.
3. Capture yoga practice video through a camera.
4. Process human body landmarks using computer vision.
5. Collect body-sensor information.
6. Store user and practice-session information.
7. Integrate machine-learning models for yoga pose analysis.
8. Provide corrective feedback to users during yoga practice.
9. Maintain organized data that can be used for further model development and evaluation.

---

# 2. High-Level System

The complete system can be understood as several layers.

```text
                         USER
                           |
                           v
                +----------------------+
                |   YogaTwin AI Web    |
                |      Application     |
                |                      |
                |  React + Vite        |
                +----------+-----------+
                           |
              +------------+------------+
              |                         |
              v                         v
      Camera / Video              Body Sensors
              |                         |
              v                         v
       MediaPipe Pose             Python Service
       Landmark Detection          Sensor Data
              |                         |
              +------------+------------+
                           |
                           v
                   Feature Processing
                           |
                           v
                     React UI
