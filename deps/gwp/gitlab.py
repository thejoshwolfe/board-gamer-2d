
import os, sys, re
from util import (
    format_script_to_call_file,
    write_file_if_not_exists,
    git,
)
from repr_yaml import (
    repr_yaml_1_2_str_plain_one_line_in_flow_out_context,
)

gitlab_ci_setup_note = (
    "To setup GitLab CI with the required access, the best available option has poor security 🙁. "
    "See this issue for a proposal to provide a secure option: https://gitlab.com/gitlab-org/gitlab/-/issues/389060 "
    "(actively being discussed as of 2024/Jan/01; if that feature is ever shipped, please open an issue against gwp to make use of it.). "
    "The workaround for now is to use a masked CI Variable that contains a Project Access Token. "
    "Settings | Access Tokens | Project Access Token | Add new token. "
    "Token name=push-refs (doesn't matter). Expiration date=<you decide the tradeoff between security and hassle>. "
    "Select a role=Developer. Select scopes=read_repository,write_repository. Create project access token | 📋 (Copy). "
    "Now go to: Settings | CI/CD | Variables | CI/CD Variables | Add variable. "
    "Type=<default>. Environments=<default>. Flags: Protect variable=no, Mask variable=yes, Expand variable reference=no (doesn't matter). "
    "Key=ACCESS_TOKEN (**IMPORTANT**). Value=<paste from above>. "
    "Note this access token will expire, and you will need to regenerate it and edit the CI/CD Variable periodically. "
    # Wouldn't it be fun if the above nonsense was possible to automate?
    # The thing is that enabling any kind of automation would first require setting up an access token, which ... well. -_-
)

def read_gitlab_ci_environment():
    url = "https://oauth2:{ACCESS_TOKEN}@{CI_SERVER_HOST}/{CI_PROJECT_PATH}.git".format(**os.environ)
    name_override = os.environ["GITLAB_USER_NAME"]
    email_override = "none@none.invalid"
    ignore_prefixes = (
        "refs/pipelines/", # These come and go while we are looking for them, so they're always different.
        "refs/environments/", # These are created for every(?) pipeline, so it would always look different.
    )
    return url, name_override, email_override, ignore_prefixes

def do_remote_install_as_gitlab_ci(force, repo_root, git_refs_program_path):
    main_yaml_path_relative = ".gitlab-ci.yml"
    template_path_relative = ".gitlab-ci/save-refs.yml"
    main_yaml_path = os.path.join(repo_root, main_yaml_path_relative)
    insert_include_hook_and_stage(main_yaml_path, template_path_relative)

    save_refs_script = format_script_to_call_file(git_refs_program_path, "--remote=gitlab-ci", "save", cwd=repo_root)

    template_path = os.path.join(repo_root, template_path_relative)
    template_yaml = """\
save-refs:
  stage: save-refs
  environment:
    # This section is to support trigging on branch deletion.
    name: save-refs/$CI_COMMIT_REF_SLUG
    on_stop: on-deleted-refs
  rules:
  - when: always
    # Note this does not support triggering on refs/merge-requests/$N/head or refs/merge-requests/$N/merge.
    # I don't think there's any way to do that.
  allow_failure: true
  script:
  - %(save_refs_script)s

# This job is to support triggering on branch deletion.
on-deleted-refs:
  stage: save-refs
  environment:
    name: save-refs/$CI_COMMIT_REF_SLUG
    action: stop
  when: manual # Not manual. Triggered by the on_stop above.
  allow_failure: true # This actually always fails.
  script: [":"] # The above job also runs, so this one doesn't need to do anything.
""" % {
        "save_refs_script": repr_yaml_1_2_str_plain_one_line_in_flow_out_context(save_refs_script),
    }

    os.makedirs(os.path.dirname(template_path), exist_ok=True)
    write_file_if_not_exists(template_path, template_yaml, force)

    git("add", template_path_relative, main_yaml_path_relative, cwd=repo_root)
    if git("status", "--porcelain", template_path_relative, main_yaml_path_relative, cwd=repo_root):
        git("status", cwd=repo_root, stdout=None)
        print("===============================================")
        print("Run 'git commit' and push the changes.")
        print("Note: " + gitlab_ci_setup_note)
        print("===============================================")

def insert_include_hook_and_stage(main_yaml_path, template_path_relative):
    if not os.path.exists(main_yaml_path):
        # Easy case.
        main_yaml = """\
include:
- local: /{}

stages:
- save-refs
""".format(template_path_relative)
        with open(main_yaml_path, "w") as f:
            f.write(main_yaml)
        return

    # Maybe it's already done.
    with open(main_yaml_path) as f:
        contents = f.read()
    if template_path_relative in contents:
        # Assume it's all good.
        return

    # Oh no.
    try:
        contents = insert_stage(contents)
        contents = insert_include(contents, template_path_relative)
    except NotGonnaHappen:
        sys.exit("\n".join("ERROR: " + line for line in [
            "Failed to edit the configuration file at {} with mere regex.".format(os.path.relpath(main_yaml_path)),
            "Please insert these two items manually:",
            "(in include:)",
            "  - local: /{}".format(template_path_relative),
            "(in stages:)",
            "  - save-refs",
            "And then re-run this script.",
        ]))

    with open(main_yaml_path, "w") as f:
        f.write(contents)

class NotGonnaHappen(Exception):
    pass

def insert_stage(contents):
    return prepend_to_top_level_array_or_at_least_try(contents, r'stages', "save-refs")
def insert_include(contents, template_path_relative):
    return prepend_to_top_level_array_or_at_least_try(contents, r'include', "local: /" + template_path_relative)

def prepend_to_top_level_array_or_at_least_try(contents, section, insertion):
    # pylint: disable=function-redefined

    # stages: []
    # stages:
    # - save-refs
    def replacer(m):
        # group(1) is "\r" or ""
        return "{}\n- {}{}".format(m.group(1), insertion, m.group(1))
    new_contents = re.sub(r'(?<=^' + section + r':) \[[ \t]*\][ \t]*(\r?)(?=\n)', replacer, contents, flags=re.MULTILINE)
    if new_contents != contents: return new_contents

    # stages: [something]
    # stages: [save-refs, something]
    new_contents = re.sub(r'(?<=^' + section + r': \[)(?=[ \t]*[^ \t\]])', insertion + ", ", contents, flags=re.MULTILINE)
    if new_contents != contents: return new_contents

    # stages:
    #  - something
    # stages:
    #  - save-refs
    #  - something
    def replacer(m):
        # group(1) is "\r" or ""
        # group(2) is the indentation and bullet, e.g. " - "
        return "{}\n{}{}{}\n{}".format(m.group(1), m.group(2), insertion, m.group(1), m.group(2))
    new_contents = re.sub(r'(?<=^' + section + r':)[ \t]*(\r?)\n([ \t]*- )', replacer, contents, flags=re.MULTILINE)
    if new_contents != contents: return new_contents

    if not re.search(r'^' + section + ':', contents, flags=re.MULTILINE):
        # Prepend entire section
        return "{}:\n- {}\n\n".format(section, insertion) + contents

    raise NotGonnaHappen

