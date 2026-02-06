import os
import random
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox

def select_source_folder():
    folder = filedialog.askdirectory(title="Выберите общую папку с файлами")
    if folder:
        source_var.set(folder)

def select_dest_folder():
    folder = filedialog.askdirectory(title="Выберите папку, где создавать папки 1..N")
    if folder:
        dest_var.set(folder)

def start_split():
    source = source_var.get().strip()
    dest = dest_var.get().strip()
    try:
        files_per_folder = int(files_per_folder_var.get())
        num_folders = int(num_folders_var.get())
    except ValueError:
        messagebox.showerror("Ошибка", "Количество файлов и количество папок должны быть целыми числами.")
        return

    if not source or not os.path.isdir(source):
        messagebox.showerror("Ошибка", "Укажите корректную общую папку с файлами.")
        return

    if not dest or not os.path.isdir(dest):
        messagebox.showerror("Ошибка", "Укажите корректную папку для создания папок 1..N.")
        return

    if files_per_folder <= 0 or num_folders <= 0:
        messagebox.showerror("Ошибка", "Числа должны быть больше нуля.")
        return

    all_files = [
        f for f in os.listdir(source)
        if os.path.isfile(os.path.join(source, f)) and f.lower().endswith(".txt")
    ]

    if not all_files:
        messagebox.showerror("Ошибка", "В общей папке нет .txt файлов.")
        return

    random.shuffle(all_files)

    total_needed = files_per_folder * num_folders
    if len(all_files) < total_needed:
        proceed = messagebox.askyesno(
            "Внимание",
            f"Файлов меньше, чем нужно (есть {len(all_files)}, нужно {total_needed}).\n"
            f"Продолжить и разложить только имеющиеся файлы?"
        )
        if not proceed:
            return

    idx = 0
    moved_count = 0

    try:
        for i in range(1, num_folders + 1):
            folder_name = str(i)
            target_folder = os.path.join(dest, folder_name)
            os.makedirs(target_folder, exist_ok=True)

            for _ in range(files_per_folder):
                if idx >= len(all_files):
                    break
                filename = all_files[idx]
                idx += 1
                src_path = os.path.join(source, filename)
                dst_path = os.path.join(target_folder, filename)

                if os.path.exists(dst_path):
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while True:
                        new_name = f"{base}_{counter}{ext}"
                        new_dst = os.path.join(target_folder, new_name)
                        if not os.path.exists(new_dst):
                            dst_path = new_dst
                            break
                        counter += 1

                shutil.move(src_path, dst_path)
                moved_count += 1

        messagebox.showinfo(
            "Готово",
            f"Перемещено файлов: {moved_count}\n"
            f"Создано папок: {num_folders} (1..{num_folders})"
        )
    except Exception as e:
        messagebox.showerror("Ошибка", f"Что-то пошло не так:\n{e}")

root_win = tk.Tk()
root_win.title("Разложить TXT по папкам 1..N")

source_var = tk.StringVar()
dest_var = tk.StringVar()
files_per_folder_var = tk.StringVar(value="20")
num_folders_var = tk.StringVar(value="10")

tk.Label(root_win, text="Общая папка с .txt файлами:").grid(row=0, column=0, sticky="w", padx=5, pady=5)
tk.Entry(root_win, textvariable=source_var, width=50).grid(row=0, column=1, padx=5, pady=5)
tk.Button(root_win, text="Обзор", command=select_source_folder).grid(row=0, column=2, padx=5, pady=5)

tk.Label(root_win, text="Папка для создания 1..N:").grid(row=1, column=0, sticky="w", padx=5, pady=5)
tk.Entry(root_win, textvariable=dest_var, width=50).grid(row=1, column=1, padx=5, pady=5)
tk.Button(root_win, text="Обзор", command=select_dest_folder).grid(row=1, column=2, padx=5, pady=5)

tk.Label(root_win, text="Файлов в каждую папку:").grid(row=2, column=0, sticky="w", padx=5, pady=5)
tk.Entry(root_win, textvariable=files_per_folder_var, width=10).grid(row=2, column=1, sticky="w", padx=5, pady=5)

tk.Label(root_win, text="Количество папок (1..N):").grid(row=3, column=0, sticky="w", padx=5, pady=5)
tk.Entry(root_win, textvariable=num_folders_var, width=10).grid(row=3, column=1, sticky="w", padx=5, pady=5)

tk.Button(root_win, text="Старт", command=start_split, width=20).grid(row=4, column=0, columnspan=3, pady=10)

root_win.mainloop()
