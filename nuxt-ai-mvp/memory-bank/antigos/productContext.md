# Product Context

## Problem Statement

- **Problem:** Traditional task managers can be static and require significant manual effort for organization, refinement, and planning. Users might struggle with breaking down complex tasks or generating ideas. Managing diverse information sources (text, files) related to tasks can be cumbersome.
- **Pain Points:** Time spent on manual task breakdown, difficulty in structuring complex projects, information scattered across different formats, lack of proactive assistance in task management.

## Proposed Solution

- **Solution:** An integrated task management application featuring a visual workflow editor combined with AI capabilities. The AI assists in refining tasks, generating sub-tasks, or providing insights based on context and potentially linked knowledge bases or data sources. It also allows incorporating surveys and data from various file types directly into the workflow.
- **Value Proposition:** A smarter, more dynamic task management experience that reduces manual effort, enhances planning through AI assistance, centralizes task-related information, and provides flexible workflow visualization.

## User Experience Goals

- **Desired Experience:** Intuitive and visual task/workflow management, seamless integration of AI assistance, easy incorporation of external data and knowledge.
- **Usability Goals:** Clear visualization of task flows, simple interaction for task creation/editing, readily accessible AI features, straightforward data source management.
- **User Feeling:** Empowered, organized, efficient, supported by intelligent assistance.

## Functional Overview

- **Functional Overview:** Users can create tasks, organize them into visual flows using a drag-and-drop interface (Vue Flow). They can interact with AI (via API calls to Google Generative AI) to refine selected tasks or generate new ones. Users can link data sources (text, Excel) and create surveys, potentially associating them with tasks or workflows. Data is stored and managed likely via Supabase.
- **Key User Flows:**
  - Creating a new task/project.
  - Building a visual task workflow.
  - Selecting a task and using the "Refine with AI" feature.
  - Adding a data source node (e.g., uploading a text file).
  - Creating and configuring a survey node.
  - Navigating the knowledge base.
