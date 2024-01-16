
import os
from util import (
    format_script_to_call_file,
    write_file_if_not_exists,
    git,
)
from repr_yaml import (
    repr_yaml_1_2_str_plain_one_line_in_flow_out_context,
)

github_action_setup_note = "To grant write permissions to a github action, go to your repo in GitHub | Settings | Actions | General | Workflow permissions | Read and write permissions. (As of 2024/01/01.)"

def read_github_action_environment():
    url = "origin"
    name_override = os.environ["GITHUB_ACTOR"]
    email_override = "none@none.invalid"
    return url, name_override, email_override, ()

def do_remote_install_as_github_action(force, repo_root, git_refs_program_path):
    save_refs_script = format_script_to_call_file(git_refs_program_path, "--remote=github-action", "save", cwd=repo_root)

    action_path = os.path.join(repo_root, ".github/workflows/save-refs.yml")
    action_yaml = """\
on:
  # Capture common activity:
  push: {}
  delete: {}
  # Capture refs/pull/$N/head and refs/pull/$N/merge:
  pull_request:
    types: [opened, closed, reopened]
jobs:
  Save-Refs:
    runs-on: ubuntu-latest
    steps:
    - name: check out gwp
      uses: actions/checkout@v4
      with:
        sparse-checkout: %(save_refs_dir)s
    - name: save refs
      run: %(save_refs_script)s
""" % {
        "save_refs_dir": repr_yaml_1_2_str_plain_one_line_in_flow_out_context(os.path.relpath(os.path.dirname(git_refs_program_path), repo_root)),
        "save_refs_script": repr_yaml_1_2_str_plain_one_line_in_flow_out_context(save_refs_script),
    }

    os.makedirs(os.path.dirname(action_path), exist_ok=True)
    write_file_if_not_exists(action_path, action_yaml, force)

    git("add", os.path.relpath(action_path, repo_root), cwd=repo_root)
    if git("status", "--porcelain", os.path.relpath(action_path, repo_root), cwd=repo_root):
        git("status", cwd=repo_root, stdout=None)
        print("===============================================")
        print("Run 'git commit' and push the changes.")
        print("Note: " + github_action_setup_note)
        print("===============================================")

