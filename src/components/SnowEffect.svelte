<script lang="ts">
	// Snow effect component - renders 200 snowflakes
	// The animations are handled by SCSS in snowEffect.scss
</script>

<!-- Snow effect for winter months -->
<div class="snow-container" aria-hidden="true">
	{#each Array(200) as _}
		<div class="snow"></div>
	{/each}
</div>
