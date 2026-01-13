$file = "C:\LLM-DevOSWE\Admin\agent\agent-ui\ollama-sandbox.html"
$content = Get-Content $file -Raw

$old = @"
        function populateVoiceSelect() {
            const select = document.getElementById('voice-select');
            if (!select) return;

            const voices = window.speechSynthesis.getVoices();
            select.innerHTML = voices.map(v =>
                ``<option value="`${v.name}" `${v.name.includes('David') || v.name.includes('Mark') ? 'selected' : ''}>`${v.name}</option>``
            ).join('');

            // Select current voice if VoiceEngine has one
            if (typeof VoiceEngine !== 'undefined') {
                const current = VoiceEngine.getSelectedVoice?.()?.name;
                if (current) select.value = current;
            }
        }
"@

$new = @"
        function populateVoiceSelect() {
            const select = document.getElementById('voice-select');
            if (!select) return;

            const voices = window.speechSynthesis.getVoices();

            // Voices load async in Chrome - if empty, wait for voiceschanged event
            if (voices.length === 0) {
                select.innerHTML = '<option value="">Loading voices...</option>';
                window.speechSynthesis.onvoiceschanged = () => populateVoiceSelect();
                return;
            }

            select.innerHTML = voices.map(v =>
                ``<option value="`${v.name}" `${v.name.includes('UK') && v.name.includes('Female') ? 'selected' : ''}>`${v.name}</option>``
            ).join('');

            // Select current voice if VoiceEngine has one
            if (typeof VoiceEngine !== 'undefined') {
                const current = VoiceEngine.getSelectedVoice?.()?.name;
                if (current) select.value = current;
            }
        }
"@

$content = $content.Replace($old, $new)
Set-Content $file $content -NoNewline
Write-Host "Voice select fix applied to sandbox!"
