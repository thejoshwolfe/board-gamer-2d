
import sys, os
import subprocess, shlex

def format_script_to_call_file(program_path, *args, cwd):
    path_to_this_script = os.path.relpath(program_path, cwd)
    if os.path.sep not in path_to_this_script:
        path_to_this_script = os.path.join(".", path_to_this_script)
    cmd = [path_to_this_script]
    cmd.extend(args)
    return shlex.join(cmd)

def write_file_if_not_exists(file_path, content, force):
    # Check for an already installed hook.
    try:
        with open(file_path) as f:
            existing_content = f.read()
    except FileNotFoundError:
        pass
    else:
        # The file already exists.
        if existing_content == content:
            return # Already done
        else:
            msg = "A different file already exists: " + file_path
            if not force:
                sys.exit("\n".join([
                    "ERROR: " + msg,
                    "ERROR: " + "Give --force to overwrite it.",
                ]))
            else:
                print("WARNING: " + msg, file=sys.stderr)
    # Need to write the file.
    with open(file_path, "w") as f:
        f.write(content)

def git(*args, **kwargs):
    run_kwargs = dict(
        check=True,
        stdout=subprocess.PIPE,
    )
    run_kwargs.update(kwargs)
    process = subprocess.run(["git"] + list(args), **run_kwargs)
    if process.stdout == None:
        return None
    return split_lines(process.stdout)

def split_lines(output):
    lines = output.decode("utf8").split("\n")
    if len(lines) >= 1:
        assert lines[-1] == ""
        del lines[-1]
    return lines

