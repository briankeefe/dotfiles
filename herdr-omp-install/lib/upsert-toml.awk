#!/usr/bin/awk -f
#
# Section-aware TOML key upsert. Idempotent.
#
# Ensures  <key> = <value>  exists inside table  [<section>]  of a TOML file.
#   - key already present in the section, same value      -> file unchanged
#   - key present in the section, different value          -> value replaced in place
#   - key absent but the section exists                    -> key appended to the section
#   - section absent                                       -> section + key appended at EOF
#
# Only the *first* occurrence of the section is edited. Commented lines
# (leading '#') are never treated as the key or the section header, so a
# "# key = ..." note is left intact and a real key is still written.
#
# Usage:
#   awk -v section=ui -v key=agent_panel_sort -v value='"priority"' \
#       -f upsert-toml.awk input.toml > output.toml
#
# `value` is written verbatim: quote strings yourself ('"priority"'), pass
# bare tokens for bools/numbers (true, 42).

BEGIN {
	if (section == "" || key == "") {
		print "upsert-toml: section and key are required" > "/dev/stderr"
		exit 2
	}
	want_header = "[" section "]"
	in_section = 0     # currently inside the target section
	seen_section = 0   # target section header has appeared
	done = 0           # key has been written/confirmed
	# build a regex-safe literal for the key (escape regex metachars)
	key_re = key
	gsub(/[][(){}.^$*+?|\\]/, "\\\\&", key_re)
}

# --- helpers ----------------------------------------------------------------

# trim leading/trailing ASCII whitespace
function trim(s) {
	sub(/^[ \t]+/, "", s)
	sub(/[ \t]+$/, "", s)
	return s
}

# is this line a table header "[...]" (not "[[...]]")? return the trimmed name or ""
function header_name(line,   t) {
	t = trim(line)
	if (t ~ /^\[[^[]/ && t ~ /\]$/) {
		sub(/^\[/, "", t)
		sub(/\][ \t]*$/, "", t)
		return trim(t)
	}
	return ""
}

# does this line define bare key `key` (ignoring comments/indent)? 
function is_key_line(line,   t) {
	t = trim(line)
	if (t ~ /^#/) return 0
	# key, optional ws, '=', anything
	return t ~ ("^" key_re "[ \t]*=")
}


{
	line = $0
	name = header_name(line)

	# entering a new table
	if (name != "") {
		# leaving the target section without having written the key -> append it now
		if (in_section && !done) {
			print key " = " value
			done = 1
		}
		in_section = (name == section)
		if (in_section) seen_section = 1
		print line
		next
	}

	# inside the target section, matching key line -> replace value, drop dup lines
	if (in_section && !done && is_key_line(line)) {
		print key " = " value
		done = 1
		next
	}
	if (in_section && done && is_key_line(line)) {
		# a duplicate of the same key later in the section: drop it
		next
	}

	print line
}

END {
	if (in_section && !done) {
		# file ended while still inside the target section
		print key " = " value
		done = 1
	}
	if (!seen_section) {
		# section never appeared: append header + key
		if (NR > 0) print ""
		print want_header
		print key " = " value
	}
}
