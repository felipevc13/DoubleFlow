export interface Task {
  id: string;
  title: string;
  completed: boolean;
  // Add any other task properties here
  [key: string]: any;
}

export interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  completedTasks: Task[];
  // Add any other state properties here
}

export interface TaskActions {
  addTask(task: Omit<Task, 'id'>): void;
  completeTask(taskId: string): void;
  setCurrentTask(task: Task | null): void;
  // Add any other actions here
}

export type TaskStore = TaskState & TaskActions;
