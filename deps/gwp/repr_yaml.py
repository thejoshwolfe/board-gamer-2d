import re, json

def repr_yaml_1_2_str_plain_one_line_in_flow_out_context(s):
    """
    This function either returns the string as-is or puts quotes around it.

    Note: This could have just been json.dumps() and it would be perfectly correct,
    but then everyone would notice that simple strings would have unnecessary quote marks,
    like:            sparse-checkout: "deps/gwp"
    instead of:      sparse-checkout: deps/gwp
    I wanted to just use json.dumps() unconditionally out of contempt for yaml,
    but somehow i feel like it expresses even more contempt to show
    just how much complexity is required to correctly deal with
    one small parameterized corner of this horrendous markupn't language.
    """
    if not is_yaml_scalar_in_flow_out_context(s):
        return json.dumps(s)
    if not is_yaml_1_2_scalar_str(s):
        return json.dumps(s)
    return s

def is_yaml_scalar_in_flow_out_context(s):
    # https://yaml.org/spec/1.2.2/#733-plain-style
    # Note: c = FLOW-OUT
    #
    # [133] ns-plain-one-line(c) ::= ns-plain-first(c) nb-ns-plain-in-line(c)

    # [126] ns-plain-first(c) ::=
    #       ( ns-char - c-indicator )
    #     | ( ( c-mapping-key       # '?'
    #         | c-mapping-value     # ':'
    #         | c-sequence-entry    # '-'
    #         ) [ lookahead = ns-plain-safe(c) ] )
    #   ns-char ::= nb-char - s-white # -x20 -x09
    #   nb-char ::= c-printable - b-char - c-byte-order-mark # -x0A -x0D -xFEFF
    # [1] c-printable ::=
    #       x09                  # Tab (\t)
    #     | x0A                  # Line feed (LF \n)
    #     | x0D                  # Carriage Return (CR \r)
    #     | [x20-x7E]            # Printable ASCII
    #     | x85                  # Next Line (NEL)
    #     | [xA0-xD7FF]          # Basic Multilingual Plane (BMP)
    #     | [xE000-xFFFD]        # Additional Unicode Areas
    #     | [x010000-x10FFFF]
    # [22] c-indicator ::= any of these: -?:,[]{}#&*!|>'"%@`
    # ns-plain-safe(FLOW-OUT)  ::= ns-char
    c_printable_non_ascii_chars = '\x85\xA0-\uD7FF\uE000-\uFEFD\uFF00-\uFFFD\U00010000-\U0010FFFF'
    ns_char_chars = '\\x21-\\x7e' + c_printable_non_ascii_chars
    ns_plain_safe_flow_out_chars = ns_char_chars
    ns_char_minus_c_indicator_chars = '$()+.-9;-=A-Z\\\\^_a-z~' + c_printable_non_ascii_chars
    ns_plain_first_flow_out = '(?:[{}]|[?:-](?=[{}]))'.format(
        ns_char_minus_c_indicator_chars,
        ns_plain_safe_flow_out_chars,
    )

    # [132] nb-ns-plain-in-line(c) ::= ( s-white* ns-plain-char(c) )*
    # [130] ns-plain-char(c) ::=
    #     ( ns-plain-safe(c) - c-mapping-value - c-comment ) # -':' -'#'
    #   | ( [ lookbehind = ns-char ] c-comment ) # '#'
    #   | ( c-mapping-value [ lookahead = ns-plain-safe(c) ] ) # ':'
    ns_plain_safe_flow_out_minus_c_mapping_value_minus_c_comment_chars = '\\x21\\x22\\x24-\\x39\\x3b-\\x7e' + c_printable_non_ascii_chars
    ns_plain_char_flow_out = '(?:[{}]|(?<=[{}])#|:(?=[{}]))'.format(
        ns_plain_safe_flow_out_minus_c_mapping_value_minus_c_comment_chars,
        ns_char_chars,
        ns_plain_safe_flow_out_chars,
    )
    nb_ns_plain_in_line_flow_out = '(?:[ \\t]*{})*'.format(ns_plain_char_flow_out)

    ns_plain_one_line_flow_out = ns_plain_first_flow_out + nb_ns_plain_in_line_flow_out

    return re.match('^' + ns_plain_one_line_flow_out + '$', s) != None

def is_yaml_1_2_scalar_str(s):
    # YAML 1.2, which is used for GitHub Actions probably.
    # https://yaml.org/spec/1.2.2/#1032-tag-resolution
    if re.match(
        '^(?:'
        '' # /* Empty */
        '|null|Null|NULL|~'
        '|true|True|TRUE|false|False|FALSE'
        '|[-+]?[0-9]+'
        '|0o[0-7]+'
        '|0x[0-9a-fA-F]+'
        '|[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][-+]?[0-9]+)?'
        '|[-+]?(?:\.inf|\.Inf|\.INF)'
        '|\.nan|\.NaN|\.NAN'
        ')$',
        s,
    ):
        return False

    # Note that YAML 1.1 has even more scalar special cases, such as the letter n,
    # but this function only supports YAML 1.2. If you're curious about 1.1: https://yaml.org/type/bool.html
    # (Naturally, version 1.1 to 1.2 is a breaking change.)
    return True

def _test(expect_plain_or_json, s):
    yaml = repr_yaml_1_2_str_plain_one_line_in_flow_out_context(s)
    if expect_plain_or_json == "p":
        assert s == yaml, "Expected plain encoding: " + repr(s)
    elif expect_plain_or_json == "j":
        assert json.dumps(s) == yaml, "Expected json quoting: " + repr(s)
    else: assert False

if __name__ == "__main__":
    _test("p", "a b c")
    _test("j", " a b c")
    _test("j", "a b c ")
    _test("j", "a: b c")
    _test("p", "a:b c")
    _test("p", "a#b c")
    _test("j", "a #b c")
    _test("j", "")
    _test("j", "\n")
    _test("j", "&")
    _test("j", "[]")
    _test("p", "a[")
    _test("j", "'")
    _test("j", '"')
    _test("j", '-')
    _test("p", '-a')
    _test("j", '-0')
    _test("j", '-.inf')
    _test("p", '-inf')
    _test("j", '0.0e0')
    _test("p", '0.0e')
