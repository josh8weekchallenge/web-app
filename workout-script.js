runWhenMemberstackReady(async function (memberstack) {
	showSkeletons();

  const member = await memberstack.getCurrentMember();
  const memberJSON = await memberstack.getMemberJSON();

  async function initializeSavedExtraWorkouts() {
    try {
      const memberData = await memberstack.getMemberJSON();
      savedExtraWorkouts = memberData?.data?.extraWorkouts || {};
      console.log("📋 Loaded saved extra workouts:", savedExtraWorkouts);
    } catch (error) {
      console.error("❌ Failed to load saved extra workouts:", error);
      savedExtraWorkouts = {};
    }
  }

  await initializeSavedExtraWorkouts();
  
  const fields = member?.data?.customFields || {};
  let currentWeek = "Week 1";
  let currentWorkouts = [];
  const gender = fields["gender"];
  const frequency = fields["training-frequency"];
  const level = fields["training-level"];
  const split = fields["training-split"];
  const category = fields["training-category"];
  console.log("📦 Memberstack fields:", gender, frequency, level, split, category);
	let currentWorkoutType = "Gym";
	let currentHomeCategory = null;

  const DOM = {
    exerciseForm: null, progressBar: null, progressLabel: null, progressHeading: null,
    completeIcon: null, notCompleteIcon: null, formNameEl: null,
    workoutCards: new Map(), weekTabs: [], exerciseItems: new Map(),
    
    init() {
      this.exerciseForm = document.querySelector('[data-form="exercise"]');
      this.progressBar = document.querySelector('[data-checklist-progress="bar"]');
      this.progressLabel = document.querySelector('[data-checklist-progress="label"]');
      this.progressHeading = document.querySelector('[data-checklist-progress="heading"]');
      this.completeIcon = document.querySelector('[data-checklist-progress="complete-icon"]');
      this.notCompleteIcon = document.querySelector('[data-checklist-progress="not-complete-icon"]');
      this.formNameEl = document.querySelector('[data-exercise="form-name"]');
      
      if (this.exerciseForm) {
        this.setGroups = this.exerciseForm.querySelectorAll('[data-set]');
        this.saveBtn = this.exerciseForm.querySelector('[data-click="save-exercise"]');
        this.notesInput = this.exerciseForm.querySelector('[data-input="notes"]');
        this.allFormInputs = this.exerciseForm.querySelectorAll('input[data-input]');
      }
      
      this.weekTabs = document.querySelectorAll('input[name="week-tab"]');
      
      document.querySelectorAll('[data-workout-index]').forEach(card => {
        const idx = parseInt(card.getAttribute('data-workout-index'));
        
        const cardCache = {
          element: card, index: idx,
          nameEls: card.querySelectorAll('[data-field="workout-name"]'),
          weekEls: card.querySelectorAll('[data-field="week"]'),
          phaseEls: card.querySelectorAll('[data-field="phase"]'),
          levelEls: card.querySelectorAll('[data-field="training-level"]'),
          durationEls: card.querySelectorAll('[data-field="duration"]'),
          imageEls: card.querySelectorAll('[data-field="image"]'),
          beginnerIcons: card.querySelectorAll('[data-workout="beginner-icon"]'),
          intermediateIcons: card.querySelectorAll('[data-workout="intermediate-icon"]'),
          advancedIcons: card.querySelectorAll('[data-workout="advanced-icon"]'),
          phase1Icons: card.querySelectorAll('[data-workout="phase-1-icon"]'),
          phase2Icons: card.querySelectorAll('[data-workout="phase-2-icon"]'),
          overlay: card.querySelector('[data-workout-progress="image-overlay"]'),
          showCompleteEls: card.querySelectorAll('[data-workout-progress="show-complete"]'),
          hideCompleteEls: card.querySelectorAll('[data-workout-progress="hide-complete"]'),
          exerciseList: document.querySelector(`[data-workout="exercise-list-workout-${idx}"]`),
		      removeBtn: card.querySelector('[data-remove-extra-workout]')
        };
        
        if (cardCache.exerciseList) {
          cardCache.exercises = new Map();
          for (let i = 1; i <= 10; i++) {
            const item = cardCache.exerciseList.querySelector(`[data-exercise="${i}"]`);
            if (item) {
              cardCache.exercises.set(i, {
                element: item,
                nameEl: item.querySelector('[data-field="exercise-name"]'),
                setsEl: item.querySelector('[data-field="exercise-sets"]'),
                repsEl: item.querySelector('[data-field="exercise-reps"]'),
                restEl: item.querySelector('[data-field="exercise-rest"]'),
                supersetIcon: item.querySelector('[data-exercise="superset-icon"]'),
                altList: item.querySelector('[data-alt-exercise="list"]'),
                resetBtn: item.querySelector('[data-alt-exercise="reset-button"]'),
                emptyIcon: item.querySelector('[data-icon="exercise-empty"]'),
                completeIcon: item.querySelector('[data-icon="exercise-complete"]'),
                altDropdown: item.querySelector('[data-exercise="alt-exercise-dropdown"]'),
                arrowIcon: item.querySelector('[data-exercise="arrow-icon"]')
              });
            }
          }
        }
        this.workoutCards.set(idx, cardCache);
      });
      
      this.globalWorkoutNames = new Map();
      for (let i = 1; i <= 10; i++) {
        const el = document.querySelector(`[data-workout-${i}="name"]`);
        if (el) this.globalWorkoutNames.set(i, el);
      }
    },
    getCard(idx) { return this.workoutCards.get(idx); },
    refreshFormCache() {
      if (this.exerciseForm) this.setGroups = this.exerciseForm.querySelectorAll('[data-set]');
    }
  };
  
  DOM.init();
  
  function isCardioExercise(exerciseData) {
    const name = exerciseData?.exercise_library?.name || exerciseData?.name || "";
    const cat = exerciseData?.exercise_library?.category || "";
    return name.toLowerCase().includes('cardio') || cat.toLowerCase().includes('cardio');
  }

  function toggleExerciseInputType(isCardio) {
    const setsRepsInputs = document.querySelectorAll('[data-input-type="sets-reps"]');
    const cardioInputs = document.querySelectorAll('[data-input-type="cardio"]');
    const cardioHideElements = document.querySelectorAll('[data-cardio="hide"]');

    if (isCardio) {
      setsRepsInputs.forEach(el => el.style.display = "none");
      cardioInputs.forEach(el => el.style.display = "block");
      cardioHideElements.forEach(el => el.style.display = "none");
    } else {
      setsRepsInputs.forEach(el => el.style.display = "flex");
      cardioInputs.forEach(el => el.style.display = "none");
      cardioHideElements.forEach(el => el.style.display = "");
    }
  }
  
  document.querySelectorAll('[data-load-extra-workout]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const group = btn.getAttribute("data-load-extra-workout");
      if (group) loadExtraWorkout(group);
    });
  });
  
  function toggleExerciseVisibility(isHomeWorkout) {
    DOM.workoutCards.forEach(cardCache => {
      if (!cardCache.exerciseList) return;
      cardCache.exercises.forEach(exerciseCache => {
        if (exerciseCache.element) {
          if (isHomeWorkout) {
            exerciseCache.element.style.display = "none";
          } else {
            const slug = exerciseCache.element.getAttribute('data-exercise-slug');
            if (slug) exerciseCache.element.style.display = "grid";
          }
        }
      });
    });
  }
  
  function updateWorkoutTypeText(isHomeWorkout) {
    document.querySelectorAll('[data-workout-type="text"]').forEach(el => {
      el.textContent = isHomeWorkout ? "Home" : "Gym";
    });
  }
  
  function toggleHomeWorkoutElements(isHomeWorkout) {
    toggleExerciseVisibility(isHomeWorkout);
  	updateWorkoutTypeText(isHomeWorkout);

    document.querySelectorAll('[data-home-workout="video"]').forEach((el, idx) => {
      el.style.display = isHomeWorkout ? "block" : "none";

      if (isHomeWorkout) {
        const exerciseList = el.closest('[data-workout^="exercise-list-workout-"]');
        if (exerciseList) {
          const listAttr = exerciseList.getAttribute('data-workout');
          const workoutIdx = parseInt(listAttr.replace('exercise-list-workout-', ''));
          const workout = currentWorkouts[workoutIdx - 1];
          const videoUrl = workout?.home_workouts_video_url;

          if (videoUrl) {
            if (el.tagName === "IFRAME") {
              const urlParams = new URLSearchParams(new URL(videoUrl).search);
              const youtubeID = urlParams.get('v');
              el.src = `https://www.youtube.com/embed/${youtubeID}?rel=0&modestbranding=1`;
            } 
            else if (el.tagName === "VIDEO") {
              el.src = videoUrl;
            }
            else if (el.tagName === "DIV") {
              const urlParams = new URLSearchParams(new URL(videoUrl).search);
              const youtubeID = urlParams.get('v');
              const embedURL = `https://www.youtube.com/embed/${youtubeID}?rel=0&modestbranding=1`;

              el.style.paddingTop = "56.17021276595745%";
              el.style.position = "relative";
              el.style.height = "0";
              el.innerHTML = `<iframe src="${embedURL}" title="Home workout video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>`;
            }
          }
        }
      }
    });
  }

  function showSkeletons() {
    document.querySelectorAll('[ms-code-skeleton]').forEach(el => {
      if (!el.querySelector('.skeleton-loader')) {
        const skeletonDiv = document.createElement('div');
        skeletonDiv.classList.add('skeleton-loader');
        el.style.position = 'relative';
        el.appendChild(skeletonDiv);
      }
    });
  }

  function hideSkeletons() {
    document.querySelectorAll('[ms-code-skeleton]').forEach(el => {
      const skeletonDiv = el.querySelector('.skeleton-loader');
      if (skeletonDiv) el.removeChild(skeletonDiv);
    });
  }
  
  document.addEventListener("click", function (e) {
    const trigger = e.target.closest('[data-click="open-complete-sheet"]');
    if (!trigger) return;

    const list = trigger.closest('[data-workout^="exercise-list-workout-"]');
    const workoutSlug = list?.getAttribute("data-workout-slug");
    const completeBtn = document.querySelector('[data-workout="complete-btn"]');

    if (completeBtn && workoutSlug) {
      completeBtn.setAttribute("data-target-slug", workoutSlug);
    }
  });
  
  document.addEventListener("click", async function (e) {
    const completeBtn = e.target.closest('[data-workout="complete-btn"]');
    if (!completeBtn) return;

    const workoutSlug = completeBtn.getAttribute("data-target-slug");
    if (!workoutSlug) return;
    
    const notesField = document.querySelector(`[data-workout-notes="${workoutSlug}"]`);
    const workoutNotes = notesField?.value?.trim() || "";

    const payload = {
      workouts: {
        [workoutSlug]: {
          status: "complete",
          completedAt: new Date().toISOString(),
          notes: workoutNotes
        }
      }
    };

    toggleButtonLoader(completeBtn, true);

    try {
      await fetchAndMergeMemberData(payload);
      const updatedJSON = await memberstack.getMemberJSON();
      memberJSON.data = updatedJSON.data;

      const weekWorkouts = currentWorkouts.filter(w => w?.week === currentWeek);
      updateWeeklyProgressBar(weekWorkouts, updatedJSON, parseInt(frequency) || 3);

      const relatedTrigger = document.querySelector(`[data-click="open-complete-sheet"][data-workout-slug="${workoutSlug}"]`);
      if (relatedTrigger) {
        relatedTrigger.classList.add("is-disabled");
        relatedTrigger.setAttribute("aria-disabled", "true");

        const textEl = relatedTrigger.querySelector('[button-text]');
        if (textEl) {
          textEl.textContent = "Workout Complete";
        } else {
          relatedTrigger.textContent = "Workout Complete";
        }
      }

      const closeBtn = document.querySelector('[data-workout="close-complete-sheet"]');
      if (closeBtn) closeBtn.click();

      triggerToast("save-success");
    } catch (err) {
      console.error("❌ Failed to complete workout:", err);
    }

    toggleButtonLoader(completeBtn, false);
  });
     
  function setupWorkoutCard(workout, cardIdx, isExtraWorkout = false) {
    const cardCache = DOM.getCard(cardIdx);
    if (!cardCache) return null;
    
    // 🔧 Reset all exercise slots before injecting new data
    cardCache.exercises.forEach((exerciseCache) => {
      const el = exerciseCache.element;
      if (!el) return;

      el.style.display = "none";
      el.classList.remove("is-last", "is-alt", "is-complete");
      el.removeAttribute("data-exercise-slug");
      el.removeAttribute("data-original-slug");
      el.removeAttribute("data-original-name");

      if (exerciseCache.nameEl) exerciseCache.nameEl.textContent = "";
      if (exerciseCache.setsEl) exerciseCache.setsEl.textContent = "";
      if (exerciseCache.repsEl) exerciseCache.repsEl.textContent = "";
      if (exerciseCache.restEl) exerciseCache.restEl.textContent = "";

      if (exerciseCache.supersetIcon) exerciseCache.supersetIcon.style.display = "none";
      if (exerciseCache.altList) exerciseCache.altList.innerHTML = "";
      if (exerciseCache.resetBtn) exerciseCache.resetBtn.style.display = "none";
      if (exerciseCache.completeIcon) exerciseCache.completeIcon.style.display = "none";
      if (exerciseCache.emptyIcon) exerciseCache.emptyIcon.style.display = "block";
      if (exerciseCache.altDropdown) exerciseCache.altDropdown.style.display = "flex";
      if (exerciseCache.arrowIcon) exerciseCache.arrowIcon.style.display = "block";
    });

    cardCache.element.style.display = "block";

    cardCache.nameEls.forEach(el => el.textContent = workout.name);
    cardCache.weekEls.forEach(el => el.textContent = workout.week);
    cardCache.phaseEls.forEach(el => el.textContent = workout.phase);        
    cardCache.levelEls.forEach(el => el.textContent = workout.training_level);
    cardCache.durationEls.forEach(el => el.textContent = workout.duration);
    cardCache.imageEls.forEach(el => {
      if (el.tagName === "IMG") el.src = workout.image_url;
    });

    cardCache.element.setAttribute("data-workout-slug", workout.slug);

    // ADD THIS SECTION FOR REMOVE BUTTON:
    if (cardCache.removeBtn) {
      if (isExtraWorkout) {
        cardCache.removeBtn.setAttribute("data-remove-extra-workout", workout.slug);
        cardCache.removeBtn.style.display = "block";
      } else {
        cardCache.removeBtn.style.display = "none";
        cardCache.removeBtn.removeAttribute("data-remove-extra-workout");
      }
    }

    const hideTags = currentWorkoutType === "Home" || category === "Subscription" || isExtraWorkout;

    cardCache.element.querySelectorAll('[data-workout="phase"]').forEach(el => {
      el.style.display = hideTags ? "none" : "";
    });
    cardCache.element.querySelectorAll('[data-workout="training-level"]').forEach(el => {
      el.style.display = hideTags ? "none" : "";
    });

    const globalNameEl = DOM.globalWorkoutNames.get(cardIdx);
    if (globalNameEl) globalNameEl.textContent = workout.name;

    setupWorkoutCompletionState(workout, cardCache);
    return cardCache;
  }

  function setupWorkoutCompletionState(workout, cardCache) {
    const triggerBtn = cardCache.exerciseList?.querySelector('[data-click="open-complete-sheet"]');
    if (triggerBtn) {
      triggerBtn.setAttribute("data-workout-slug", workout.slug);

      const isComplete = memberJSON?.data?.workouts?.[workout.slug]?.status === "complete";

      triggerBtn.classList.toggle("is-disabled", isComplete);
      triggerBtn.setAttribute("aria-disabled", isComplete ? "true" : "false");

      if (isComplete) {
        const textEl = triggerBtn.querySelector('[button-text]');
        if (textEl) {
          textEl.textContent = "Workout Complete";
        } else {
          triggerBtn.textContent = "Workout Complete";
        }
      }
    }

    const savedNotes = memberJSON?.data?.workouts?.[workout.slug]?.notes || "";
    const notesField = cardCache.exerciseList?.querySelector(`[data-workout-notes]`);
    if (notesField) {
      notesField.value = savedNotes;
      notesField.setAttribute("data-workout-notes", workout.slug);
    }

    const isWorkoutComplete = memberJSON?.data?.workouts?.[workout.slug]?.status === "complete";

    if (cardCache.overlay) cardCache.overlay.classList.toggle("is-complete", isWorkoutComplete);

    cardCache.showCompleteEls.forEach(el => {
      el.style.display = isWorkoutComplete ? "block" : "none";
    });

    cardCache.hideCompleteEls.forEach(el => {
      el.style.display = isWorkoutComplete ? "none" : "block";
    });
  }

  function setupExercise(exercise, exerciseIdx, cardCache, workout) {
    const exerciseCache = cardCache.exercises.get(exerciseIdx);
    if (!exerciseCache) return;

    const item = exerciseCache.element;

    if (exerciseIdx === workout.exercises.length) {
      item.classList.add("is-last");
    } else {
      item.classList.remove("is-last");
    }

    if (exerciseCache.altList) {
      exerciseCache.altList.innerHTML = "";

      const lib = exercise.exercise_library || {};
      for (let a = 1; a <= 3; a++) {
        const slug = lib[`alt_${a}_slug`];
        const name = lib[`alt_${a}_name`];
        if (slug && name) {
          const altEl = document.createElement("div");
          altEl.setAttribute("data-alt-exercise", "item");
          altEl.setAttribute("data-alt-exercise-slug", slug);
          altEl.classList.add("alt-exercise-item");
          altEl.textContent = name;
          exerciseCache.altList.appendChild(altEl);
        }
      }
    }
    
    item.style.display = "grid";
    item.setAttribute("data-exercise-slug", exercise.slug);
    item.setAttribute("data-original-slug", exercise.slug);
    item.setAttribute("data-original-name", exercise.exercise_library?.name || exercise.name);

    if (exerciseCache.nameEl) exerciseCache.nameEl.textContent = exercise.exercise_library?.name || exercise.name;
    if (exerciseCache.setsEl) exerciseCache.setsEl.textContent = exercise.sets;
    if (exerciseCache.repsEl) exerciseCache.repsEl.textContent = exercise.reps;
    if (exerciseCache.restEl) exerciseCache.restEl.textContent = exercise.rest;
    if (exerciseCache.supersetIcon) exerciseCache.supersetIcon.style.display = exercise.is_superset ? "block" : "none";
      
    const isCardio = isCardioExercise(exercise);

    item.querySelectorAll('[data-sets-reps="cardio-hide"]').forEach(el => {
      el.style.display = isCardio ? "none" : "";
    });

    restoreExerciseState(exercise, item, workout.slug);
  }

  function restoreExerciseState(exercise, exerciseItem, workoutSlug) {
    const savedData = memberJSON?.data?.workouts?.[workoutSlug]?.["exercise-data"]?.[exercise.slug];
    const usedAltSlug = savedData?.usedAlt;

    if (usedAltSlug) {
      const altItem = exerciseItem.querySelector(`[data-alt-exercise-slug="${usedAltSlug}"]`);
      const altName = altItem?.textContent;

      if (altItem && altName) {
        exerciseItem.setAttribute("data-exercise-slug", usedAltSlug);
        exerciseItem.classList.add("is-alt");

        const nameEl = exerciseItem.querySelector('[data-field="exercise-name"]');
        if (nameEl) nameEl.textContent = altName;

        exerciseItem.querySelectorAll('[data-alt-exercise="item"]').forEach(el => {
          el.classList.remove("is-selected");
          el.querySelector(".selected-icon")?.remove();
        });

        altItem.classList.add("is-selected");

        const tick = document.createElement("img");
        tick.src = "https://cdn.prod.website-files.com/65d47e7f10e31f7cc2338080/682d6f1196bfe0471ee95fa4_Tick.svg";
        tick.classList.add("selected-icon");
        tick.alt = "Selected";
        altItem.insertBefore(tick, altItem.firstChild);

        const resetBtn = exerciseItem.querySelector('[data-alt-exercise="reset-button"]');
        if (resetBtn) resetBtn.style.setProperty("display", "flex");
      }
    }

    const isComplete = Object.entries(savedData || {}).some(
      ([key, val]) => key.startsWith("set-") && (val.reps || val.weight)
    );

    updateExerciseCompletionUI(exerciseItem, isComplete);
  }




  

  



  

  // 1. Add this function to remove extra workout from persistence
  async function removeExtraWorkoutFromPersistence(week, muscleGroup) {
    console.log(`💾 Removing "${muscleGroup}" from "${week}"`);
    
    try {
      const currentData = memberJSON?.data?.extraWorkouts || {};
      const weekData = currentData[week] || [];
      
      console.log(`📋 Before removal:`, weekData);
      
      const updatedWeekData = weekData.filter(group => {
        const keep = group !== muscleGroup;
        console.log(`🔍 "${group}" !== "${muscleGroup}" = ${keep}`);
        return keep;
      });
      
      console.log(`📋 After removal:`, updatedWeekData);
      console.log(`📊 Removed ${weekData.length - updatedWeekData.length} items`);
      
      const payload = {
        extraWorkouts: {
          ...currentData,
          [week]: updatedWeekData
        }
      };
  
      console.log(`📤 Sending payload:`, payload);
      
      await fetchAndMergeMemberData(payload);
      const updatedJSON = await memberstack.getMemberJSON();
      memberJSON.data = updatedJSON.data;
      savedExtraWorkouts = updatedJSON.data.extraWorkouts || {};
      
      console.log(`✅ Database updated. New data:`, savedExtraWorkouts);
    } catch (error) {
      console.error("❌ Failed to remove extra workout:", error);
    }
  }
  
  async function removeExtraWorkout(workoutSlug) {
    console.log(`🗑️ Starting removal for: ${workoutSlug}`);
    
    const workoutIndex = currentWorkouts.findIndex(w => w.slug === workoutSlug);
    if (workoutIndex === -1) {
      console.error(`❌ Workout not found: ${workoutSlug}`);
      return;
    }
  
    const workout = currentWorkouts[workoutIndex];
    console.log(`✅ Found workout: ${workout.name}`);
    
    // Find the matching button to get the exact muscle group name that was saved
    let muscleGroup = null;
    document.querySelectorAll('[data-load-extra-workout]').forEach(btn => {
      const btnGroup = btn.getAttribute("data-load-extra-workout");
      if (workoutSlug.toLowerCase().includes(btnGroup.toLowerCase())) {
        muscleGroup = btnGroup;
        console.log(`🎯 Matched button group: ${btnGroup}`);
      }
    });
    
    // If no button match, extract from slug and capitalize properly
    if (!muscleGroup) {
      muscleGroup = workoutSlug.replace('extra-workout-', '').split('-')[0];
      muscleGroup = muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1).toLowerCase();
      console.log(`🔄 Fallback extraction: ${muscleGroup}`);
    }
    
    console.log(`📊 Current saved data:`, savedExtraWorkouts);
    console.log(`📅 Current week data:`, savedExtraWorkouts[currentWeek]);
    console.log(`💪 Trying to remove: "${muscleGroup}" from "${currentWeek}"`);
    
    await removeExtraWorkoutFromPersistence(currentWeek, muscleGroup);
    currentWorkouts.splice(workoutIndex, 1);
    
    const cardCache = DOM.getCard(workoutIndex + 1);
    if (cardCache) {
      cardCache.element.style.display = "none";
      console.log(`👻 Hidden card at index ${workoutIndex + 1}`);
    }
    
    updateExtraWorkoutButtons();
    setTimeout(() => initializeCarousel(currentWorkouts.length), 100);
    triggerToast("remove-success");
    
    console.log(`✅ Removal complete`);
  }
  
  // 3. Add event listener for remove buttons (add this in your main function)
  document.addEventListener("click", async function (e) {
    const removeBtn = e.target.closest('[data-remove-extra-workout]');
    if (!removeBtn) return;
    
    e.preventDefault();
    
    const workoutSlug = removeBtn.getAttribute("data-remove-extra-workout");
    if (!workoutSlug) return;
    
    // Optional: Add confirmation dialog
    const confirmRemove = confirm("Are you sure you want to remove this extra workout?");
    if (!confirmRemove) return;
    
    toggleButtonLoader(removeBtn, true);
    
    try {
      await removeExtraWorkout(workoutSlug);
    } catch (error) {
      console.error("❌ Failed to remove extra workout:", error);
      triggerToast("remove-error");
    }
    
    toggleButtonLoader(removeBtn, false);
  });
  
  async function loadWorkoutsByWeek({ week = currentWeek, type, type_category } = {}) {
  	showSkeletons();
    
    const isHomeWorkout = type === "Home";
    
    const response = await fetch("https://xwmy-1hew-v3j0.e2.xano.io/api:SN0V_YjN/getUserWorkouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gender, training_frequency: frequency, training_level: level, training_split: split,
        category, week, type, type_category
      })
    });
     
    currentWeek = week;
    
    const container = document.getElementById("workout-container");
    
    container.classList.add("is-fading-out");
    await new Promise(resolve => setTimeout(resolve, 200));
    container.classList.remove("is-fading-out");
    container.classList.add("is-fading-in");
    
    const data = await response.json();    
    const workouts = data?.workouts || [];
    currentWorkouts = workouts;

    if (!workouts.length) return;

    DOM.workoutCards.forEach(cardCache => {
      cardCache.element.style.display = 'none';
    });

    workouts.forEach((workout, i) => {
      const cardCache = setupWorkoutCard(workout, i + 1, false);
      if (!cardCache) return;
      
      const isBeginner = workout.training_level === "Beginner";
      const isIntermediate = workout.training_level === "Intermediate";
      const isAdvanced = workout.training_level === "Advanced";
      
      cardCache.beginnerIcons.forEach(el => el.style.display = isBeginner ? "flex" : "none");
      cardCache.intermediateIcons.forEach(el => el.style.display = isIntermediate ? "flex" : "none");
      cardCache.advancedIcons.forEach(el => el.style.display = isAdvanced ? "flex" : "none");

      cardCache.phase1Icons.forEach(el => el.style.display = workout.phase === "Phase 1" ? "block" : "none");
      cardCache.phase2Icons.forEach(el => el.style.display = workout.phase === "Phase 2" ? "block" : "none");

      const sortedExercises = [...(workout.exercises || [])].sort((a, b) => a.exercise_order - b.exercise_order);
      
      if (sortedExercises.length === 0 && cardCache.exerciseList) {
        cardCache.exerciseList.setAttribute("data-workout-slug", workout.slug);
      }

      sortedExercises.forEach((exercise, x) => {
        if (!cardCache.exerciseList) return;
        cardCache.exerciseList.setAttribute("data-workout-slug", workout.slug);
        setupExercise(exercise, x + 1, cardCache, { ...workout, exercises: sortedExercises });
      });

      for (let x = sortedExercises.length + 1; x <= 10; x++) {
        const exerciseCache = cardCache.exercises.get(x);
        if (exerciseCache?.element) {
          exerciseCache.element.style.display = "none";
        }
      }
    });

    for (let i = workouts.length + 1; i <= DOM.workoutCards.size; i++) {
      const cardCache = DOM.getCard(i);
      if (cardCache) cardCache.element.style.display = "none";
    }
      
    updateWeeklyProgressBar(workouts, memberJSON, {
      "3 Days Per Week": 3,
      "4 Days Per Week": 4,
      "5 Days Per Week": 5
    }[frequency] || 3);
    
    await new Promise(resolve => setTimeout(resolve, 40));

    // 5. ADD THESE LINES in loadWorkoutsByWeek function, right before the final requestAnimationFrame(() => {
    // Load saved extra workouts for this week (only for gym workouts)
    if (!isHomeWorkout) {
      await loadSavedExtraWorkouts(week);
    }

    requestAnimationFrame(() => {
      container.classList.remove("is-fading-in");
      hideSkeletons();
      toggleHomeWorkoutElements(isHomeWorkout);
      //const slideCount = isHomeWorkout ? 3 : (parseInt(frequency) || 3);
      const slideCount = isHomeWorkout ? 3 : currentWorkouts.length;
      initializeCarousel(slideCount);
    });
  }
   
  function isExtraWorkoutAlreadyLoaded(muscleGroup) {
    return currentWorkouts.some(workout => {
      return workout.slug && workout.slug.includes(`extra-workout-${muscleGroup.toLowerCase()}`);
    });
  }

  // 5. Update the updateExtraWorkoutButtons function to handle removed workouts
  function updateExtraWorkoutButtons() {
    document.querySelectorAll('[data-load-extra-workout]').forEach(btn => {
      const muscleGroup = btn.getAttribute("data-load-extra-workout");
      if (!muscleGroup) return;
  
      const isAlreadyLoaded = isExtraWorkoutAlreadyLoaded(muscleGroup);
  
      if (isAlreadyLoaded) {
        btn.classList.add("is-disabled");
        btn.setAttribute("aria-disabled", "true");
        btn.textContent = "Workout Already Added";
        btn.style.pointerEvents = "none";
      } else {
        btn.classList.remove("is-disabled");
        btn.setAttribute("aria-disabled", "false");
        btn.textContent = "Add Workout"; // Changed from "Next"
        btn.style.pointerEvents = "auto";
      }
    });
  }

  async function saveExtraWorkoutToPersistence(week, muscleGroup) {
    try {
      const currentData = memberJSON?.data?.extraWorkouts || {};
      const weekData = currentData[week] || [];
      
      if (!weekData.includes(muscleGroup)) {
        weekData.push(muscleGroup);
      }
  
      const payload = {
        extraWorkouts: {
          ...currentData,
          [week]: weekData
        }
      };
  
      await fetchAndMergeMemberData(payload);
      const updatedJSON = await memberstack.getMemberJSON();
      memberJSON.data = updatedJSON.data;
      savedExtraWorkouts = updatedJSON.data.extraWorkouts || {};
      
      console.log(`✅ Saved extra workout: ${muscleGroup} to ${week}`);
    } catch (error) {
      console.error("❌ Failed to save extra workout:", error);
    }
  }
  
  async function loadSavedExtraWorkouts(week) {
    const extraWorkoutsForWeek = savedExtraWorkouts[week] || [];
    
    for (const muscleGroup of extraWorkoutsForWeek) {
      if (!isExtraWorkoutAlreadyLoaded(muscleGroup)) {
        console.log(`🔄 Loading saved extra workout: ${muscleGroup} for ${week}`);
        
        try {
          const response = await fetch("https://xwmy-1hew-v3j0.e2.xano.io/api:SN0V_YjN/getUserWorkouts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gender, training_frequency: frequency, training_level: level, training_split: split,
              category: "Extra", week: week, extra_workout: true, extra_workout_category: muscleGroup
            })
          });
  
          const data = await response.json();
          const workout = data?.workouts?.[0];
  
          if (workout) {
            const nextIdx = currentWorkouts.length + 1;
            const cardCache = setupWorkoutCard(workout, nextIdx, true);
            if (cardCache) {
              currentWorkouts.push(workout);
  
              const sortedExercises = [...(workout.exercises || [])].sort((a, b) => a.exercise_order - b.exercise_order);
              cardCache.exerciseList?.setAttribute("data-workout-slug", workout.slug);
  
              sortedExercises.forEach((exercise, i) => {
                setupExercise(exercise, i + 1, cardCache, { ...workout, exercises: sortedExercises });
              });
  
              for (let i = sortedExercises.length + 1; i <= 10; i++) {
                const exCache = cardCache.exercises.get(i);
                if (exCache?.element) exCache.element.style.display = "none";
              }
            }
          }
        } catch (error) {
          console.error(`❌ Failed to load saved extra workout ${muscleGroup}:`, error);
        }
      }
    }
    
    updateExtraWorkoutButtons();

    // Add a delay before reinitializing carousel
    setTimeout(() => {
      initializeCarousel(currentWorkouts.length);
    }, 100);
  }

  async function loadExtraWorkout(muscleGroup) {
    if (isExtraWorkoutAlreadyLoaded(muscleGroup)) return;

    const response = await fetch("https://xwmy-1hew-v3j0.e2.xano.io/api:SN0V_YjN/getUserWorkouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gender, training_frequency: frequency, training_level: level, training_split: split,
        category: "Extra", week: currentWeek, extra_workout: true, extra_workout_category: muscleGroup
      })
    });

    const data = await response.json();
    const workout = data?.workouts?.[0];

    if (!workout) return;

    const nextIdx = currentWorkouts.length + 1;

    const cardCache = setupWorkoutCard(workout, nextIdx, true);
    if (!cardCache) return;

    currentWorkouts.push(workout);

    // 4. ADD THIS LINE in your loadExtraWorkout function
    await saveExtraWorkoutToPersistence(currentWeek, muscleGroup);

    const sortedExercises = [...(workout.exercises || [])].sort((a, b) => a.exercise_order - b.exercise_order);

    cardCache.exerciseList?.setAttribute("data-workout-slug", workout.slug);

    sortedExercises.forEach((exercise, i) => {
      setupExercise(exercise, i + 1, cardCache, { ...workout, exercises: sortedExercises });
    });

    for (let i = sortedExercises.length + 1; i <= 10; i++) {
      const exCache = cardCache.exercises.get(i);
      if (exCache?.element) exCache.element.style.display = "none";
    }
    
    updateExtraWorkoutButtons();
    initializeCarousel(currentWorkouts.length, currentWorkouts.length - 1);
  }
  
  const handleSave = async ({ exerciseForm, setGroups, exerciseItem, saveBtn, memberstack }) => {
    const exerciseSlug = exerciseForm.getAttribute("data-exercise");
    const workoutSlug = exerciseForm.getAttribute("data-workout");
    const wasWorkoutComplete = memberJSON?.data?.workouts?.[workoutSlug]?.status === "complete";
    if (!exerciseSlug || !workoutSlug) return;

    const actualSlug = exerciseItem.getAttribute("data-exercise-slug");
    const originalSlug = exerciseItem.getAttribute("data-original-slug");

    const workoutData = currentWorkouts.find(w => w.slug === workoutSlug);
    const exerciseData = workoutData?.exercises?.find(ex => {
      return ex.slug === actualSlug ||
        ex.exercise_library?.alt_1_slug === actualSlug ||
        ex.exercise_library?.alt_2_slug === actualSlug ||
        ex.exercise_library?.alt_3_slug === actualSlug;
    });

    const isCardio = isCardioExercise(exerciseData);

    let exerciseSpecificData = {};

    if (isCardio) {
      const durationInput = exerciseForm.querySelector('[data-input-type="cardio"] input[data-input="duration"]');
      const durationUnitSelect = exerciseForm.querySelector('[data-input-type="cardio"] select[data-input="duration-unit"]');

      const durationValue = durationInput?.value.trim() || "";
      const durationUnit = durationUnitSelect?.value || "Minutes";

      if (durationValue) {
        const fullDuration = `${durationValue} ${durationUnit}`;
        exerciseSpecificData = { 
          duration: fullDuration,
          durationValue: durationValue,
          durationUnit: durationUnit
        };
      }
    } else {
      // Save sets/reps/weight data for non-cardio exercises
      setGroups.forEach((group, i) => {
        const weightInput = group.querySelector('[data-input="weight"]');
        const repsInput = group.querySelector('[data-input="reps"]');
        
        const weight = weightInput?.value.trim() || "";
        const reps = repsInput?.value.trim() || "";
        
        if (weight || reps) {
          exerciseSpecificData[`set-${i + 1}`] = {
            weight: weight,
            reps: reps
          };
        }
      });
    }

    const notes = DOM.notesInput?.value || "";

    const payload = {
      workouts: {
        [workoutSlug]: {
          "exercise-data": {
            [originalSlug]: {
              usedAlt: actualSlug !== originalSlug ? actualSlug : undefined,
              notes,
              ...exerciseSpecificData
            }
          }
        }
      }
    };

    if (Object.keys(exerciseSpecificData).length > 0) {
      const currentHistory = memberJSON?.data?.exerciseHistory || {};

      payload.exerciseHistory = {
        ...currentHistory,
        [originalSlug]: {
          lastLogged: new Date().toISOString(),
          ...exerciseSpecificData
        }
      };
    }

    toggleButtonLoader(saveBtn, true);
    await fetchAndMergeMemberData(payload);

    const updatedJSON = await memberstack.getMemberJSON();
    memberJSON.data = updatedJSON.data;

    triggerToast("save-success");

    const hasData = isCardio ? 
      !!exerciseSpecificData.duration : 
      Object.values(exerciseSpecificData).some(set => set.reps || set.weight);

    updateExerciseCompletionUI(exerciseItem, hasData);

    toggleButtonLoader(saveBtn, false);

    const nowComplete = updatedJSON?.data?.workouts?.[workoutSlug]?.status === "complete";

    if (!wasWorkoutComplete && nowComplete) {
      const weekWorkouts = currentWorkouts.filter(w => w?.week === currentWeek);
      updateWeeklyProgressBar(weekWorkouts, updatedJSON, parseInt(frequency) || 3);     
    }
  };

  
  function setHistoryStyle(input, isHistory) {
    if (isHistory) {
      input.style.color = "#999";
      input.dataset.history = "true";
    } else {
      input.style.color = "";
      delete input.dataset.history;
    }
  }

  document.addEventListener("click", function (e) {
    const clickedAlt = e.target.closest('[data-alt-exercise="item"]');
    if (clickedAlt) {
      const altSlug = clickedAlt.getAttribute("data-alt-exercise-slug");
      const altName = clickedAlt.textContent;
      const exerciseItem = clickedAlt.closest('[data-exercise-slug]');
      if (!exerciseItem) return;

      exerciseItem.setAttribute("data-exercise-slug", altSlug);
      const nameEl = exerciseItem.querySelector('[data-field="exercise-name"]');
      if (nameEl) nameEl.textContent = altName;

      exerciseItem.classList.add("is-alt");

      exerciseItem.querySelectorAll('[data-alt-exercise="item"]').forEach(el => {
        el.classList.remove("is-selected");
        const tick = el.querySelector(".selected-icon");
        if (tick) tick.remove();
      });

      clickedAlt.classList.add("is-selected");
      const tick = document.createElement("img");
      tick.src = "https://cdn.prod.website-files.com/65d47e7f10e31f7cc2338080/682d6f1196bfe0471ee95fa4_Tick.svg";
      tick.classList.add("selected-icon");
      tick.alt = "Selected";
      clickedAlt.insertBefore(tick, clickedAlt.firstChild);

      const resetBtn = exerciseItem.querySelector('[data-alt-exercise="reset-button"]');
      if (resetBtn) resetBtn.style.display = "flex";
      return;
    }

    const resetClicked = e.target.closest('[data-alt-exercise="reset-button"]');
    if (resetClicked) {
      const exerciseItem = resetClicked.closest('[data-exercise-slug]');
      if (!exerciseItem) return;

      const originalSlug = exerciseItem.getAttribute("data-original-slug");
      const originalName = exerciseItem.getAttribute("data-original-name");

      exerciseItem.setAttribute("data-exercise-slug", originalSlug);
      const nameEl = exerciseItem.querySelector('[data-field="exercise-name"]');
      if (nameEl) nameEl.textContent = originalName;

      exerciseItem.classList.remove("is-alt");

      const allAlts = exerciseItem.querySelectorAll('[data-alt-exercise="item"]');
      allAlts.forEach(el => {
        el.classList.remove("is-selected");
        const existingTick = el.querySelector(".selected-icon");
        if (existingTick) existingTick.remove();
      });

      resetClicked.style.display = "none";
    }
  });

  document.addEventListener("click", async function (e) {
    if (e.target.closest('[data-form="exercise"]')) return;

    const trigger = e.target.closest('[data-click="trigger-form"]');
    if (!trigger) return;

    const exerciseItem = trigger.closest('[data-exercise]');
    if (!exerciseItem) return;

    const exerciseForm = DOM.exerciseForm;
    const setGroups = DOM.setGroups;

    const actualSlug = exerciseItem.getAttribute('data-exercise-slug');
    const originalSlug = exerciseItem.getAttribute('data-original-slug');
    const exerciseSlug = actualSlug;

    const list = exerciseItem.closest('[data-workout^="exercise-list-workout-"]');
    const workoutSlug = list?.getAttribute('data-workout-slug');
    const setsString = exerciseItem.querySelector('[data-field="exercise-sets"]')?.textContent || '3 sets';
    const numberOfSets = parseInt(setsString) || 3;

    const workoutData = currentWorkouts.find(w => w.slug === workoutSlug);
    const exerciseData = workoutData?.exercises?.find(ex => {
      return ex.slug === actualSlug ||
        ex.exercise_library?.alt_1_slug === actualSlug ||
        ex.exercise_library?.alt_2_slug === actualSlug ||
        ex.exercise_library?.alt_3_slug === actualSlug;
    });
    
    const isCardio = isCardioExercise(exerciseData);
    toggleExerciseInputType(isCardio);
    
    const wrapper = document.querySelector('[data-exercise="video-embed"]');
    const fallback = document.querySelector('[data-exercise="video-fallback"]');
    
    let matchedVideoURL = null;

    function findLibraryExerciseBySlug(slug) {
      for (const workout of currentWorkouts) {
        for (const exercise of workout.exercises) {
          const lib = exercise.exercise_library;
          if (lib?.slug === slug) return lib;
        }
      }
      return null;
    }

    const selectedLibraryItem = findLibraryExerciseBySlug(actualSlug);

    if (selectedLibraryItem) {
      matchedVideoURL = gender === "Male"
        ? selectedLibraryItem.video_url_male
        : selectedLibraryItem.video_url_female;
    }

    if (wrapper) wrapper.innerHTML = "";
    if (fallback) fallback.style.display = "none";

    if (wrapper && matchedVideoURL) {
      let youtubeID = "";
      if (matchedVideoURL.includes("watch?v=")) {
        const params = new URLSearchParams(new URL(matchedVideoURL).search);
        youtubeID = params.get("v");
      } else if (matchedVideoURL.includes("shorts/")) {
        youtubeID = matchedVideoURL.split("shorts/")[1].split("?")[0];
      } else {
        youtubeID = matchedVideoURL.split("/").pop().split("?")[0];
      }
      
      const embedURL = `https://www.youtube.com/embed/${youtubeID}?rel=0&modestbranding=1`;

      wrapper.innerHTML = `<iframe width="100%" height="100%" src="${embedURL}" title="Exercise video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      wrapper.style.display = "block";
    } else {
    	wrapper.style.display = "none";
      if (fallback) fallback.style.display = "flex";
    }
  
    exerciseForm.setAttribute('data-exercise', exerciseSlug);
    if (workoutSlug) exerciseForm.setAttribute('data-workout', workoutSlug);

    setGroups.forEach((group, i) => {
      group.style.display = i < numberOfSets ? 'flex' : 'none';
    });
        
    DOM.allFormInputs.forEach(input => {
      input.value = '';
      setHistoryStyle(input, false);
    });
    exerciseForm.style.display = 'block';

    if (DOM.notesInput) DOM.notesInput.value = "";

    const currentData = memberJSON?.data?.workouts?.[workoutSlug]?.["exercise-data"]?.[originalSlug];
    const exerciseHistory = memberJSON?.data?.exerciseHistory || {};
    const historyData = exerciseHistory[originalSlug];

    if (isCardio) {
      const durationInput = exerciseForm.querySelector('[data-input-type="cardio"] input[data-input="duration"]');

      if (currentData?.duration && durationInput) {
        durationInput.value = currentData.duration;
        setHistoryStyle(durationInput, false);
      } else if (historyData?.duration && durationInput && !currentData) {
        durationInput.value = historyData.duration;
        setHistoryStyle(durationInput, true);
      } else if (durationInput) {
        durationInput.value = "";
        setHistoryStyle(durationInput, false);
      }
    } else {
      if (historyData && !currentData) {
        Object.entries(historyData).forEach(([key, val]) => {
          if (!key.startsWith("set-")) return;

          const setIdx = parseInt(key.replace("set-", "")) - 1;
          if (setIdx >= numberOfSets) return;

          const group = setGroups[setIdx];
          const weightInput = group?.querySelector('[data-input="weight"]');
          const repsInput = group?.querySelector('[data-input="reps"]');

          if (weightInput && val.weight) {
            weightInput.value = val.weight;
            setHistoryStyle(weightInput, true);
          }
          if (repsInput && val.reps) {
            repsInput.value = val.reps;
            setHistoryStyle(repsInput, true);
          }

          group.querySelector('[data-icon="empty"]')?.style.setProperty("display", "block");
          group.querySelector('[data-icon="populated"]')?.style.setProperty("display", "none");
        });
      }

      if (currentData) {
        Object.entries(currentData).forEach(([key, val]) => {
          if (key.startsWith("set-")) {
            const setIdx = parseInt(key.replace("set-", "")) - 1;
            const group = setGroups[setIdx];
            if (group) {
              const weightInput = group.querySelector('[data-input="weight"]');
              const repsInput = group.querySelector('[data-input="reps"]');

              if (weightInput) {
                weightInput.value = val.weight || "";
                setHistoryStyle(weightInput, false);
              }
              if (repsInput) {
                repsInput.value = val.reps || "";
                setHistoryStyle(repsInput, false);
              }

              const isFilled = val.reps || val.weight;
              group.querySelector('[data-icon="empty"]')?.style.setProperty("display", isFilled ? "none" : "block");
              group.querySelector('[data-icon="populated"]')?.style.setProperty("display", isFilled ? "block" : "none");
            }
          }
        });

        let isComplete = false;
        Object.entries(currentData || {}).forEach(([key, val]) => {
          if (key.startsWith("set-") && (val.reps || val.weight)) {
            isComplete = true;
          }
        });

        if (isComplete && !exerciseItem.classList.contains("is-complete")) {
          exerciseItem.classList.add("is-complete");
        } else if (!isComplete && exerciseItem.classList.contains("is-complete")) {
          exerciseItem.classList.remove("is-complete");
        }

        const notes = currentData.notes || "";
        if (DOM.notesInput) DOM.notesInput.value = notes;
      }

      setGroups.forEach((group, i) => {
        const reps = group.querySelector('[data-input="reps"]')?.value.trim();
        const weight = group.querySelector('[data-input="weight"]')?.value.trim();

        const emptyIcon = group.querySelector('[data-icon="empty"]');
        const populatedIcon = group.querySelector('[data-icon="populated"]');

        const isFilled = reps || weight;

        if (emptyIcon) emptyIcon.style.display = isFilled ? "none" : "block";
        if (populatedIcon) populatedIcon.style.display = isFilled ? "block" : "none";
      });
    }

    if (isCardio && currentData?.duration) {
      if (!exerciseItem.classList.contains("is-complete")) {
        exerciseItem.classList.add("is-complete");
      }
    } else if (isCardio && !currentData?.duration) {
      if (exerciseItem.classList.contains("is-complete")) {
        exerciseItem.classList.remove("is-complete");
      }
    }
    
    const saveBtn = DOM.saveBtn;
    
    exerciseForm.addEventListener("keydown", (e) => {
      if (e.target.dataset.history === "true") {
        e.target.value = "";
        setHistoryStyle(e.target, false);
      }
    }, true);

    exerciseForm.addEventListener("input", (e) => {
      if (e.target.dataset.history) {
        setHistoryStyle(e.target, false);
      }

      let hasData = false;

      const isCurrentlyCardio = document.querySelector('[data-input-type="cardio"]')?.style.display !== "none";

      if (isCurrentlyCardio) {
        const durationInput = exerciseForm.querySelector('[data-input-type="cardio"] input[data-input="duration"]');
        const durationUnitSelect = exerciseForm.querySelector('[data-input-type="cardio"] select[data-input="duration-unit"]');

        const durationValue = durationInput?.value.trim();
        const durationUnit = durationUnitSelect?.value;

        hasData = !!(durationValue && durationUnit);
      } else {
        setGroups.forEach((group) => {
          const reps = group.querySelector('[data-input="reps"]')?.value.trim();
          const weight = group.querySelector('[data-input="weight"]')?.value.trim();
          const isFilled = reps || weight;

          group.querySelector('[data-icon="empty"]')?.style.setProperty("display", isFilled ? "none" : "block");
          group.querySelector('[data-icon="populated"]')?.style.setProperty("display", isFilled ? "block" : "none");

          if (isFilled) hasData = true;
        });
      }

      saveBtn.classList.toggle("is-disabled", !hasData);
    });
    
    saveBtn.onclick = () => {
      handleSave({
        exerciseForm,
        setGroups,
        exerciseItem,
        saveBtn,
        memberstack
      });
    };
    
    const exerciseName = exerciseItem.querySelector('[data-field="exercise-name"]')?.textContent || '';
    if (DOM.formNameEl) DOM.formNameEl.textContent = exerciseName;
  });
    
  DOM.weekTabs.forEach((radio) => {
    radio.addEventListener('change', function () {
      const selectedWeek = this.getAttribute('data-week');
      const normalisedWeek = selectedWeek.replace('week-', 'Week ').replace(/\b\w/g, l => l.toUpperCase());

      if (currentWorkoutType === "Home") {
        loadWorkoutsByWeek({
          week: normalisedWeek,
          type: "Home",
          type_category: currentHomeCategory
        });
      } else {
        loadWorkoutsByWeek({ week: normalisedWeek });
      }
    });
  });
  
  const checkedRadio = document.querySelector('input[name="week-tab"]:checked');
  if (checkedRadio) {
    const raw = checkedRadio.getAttribute('data-week');
    const normalisedWeek = raw.replace('week-', 'Week ').replace(/\b\w/g, l => l.toUpperCase());
    
    if (currentWorkoutType === "Home") {
      loadWorkoutsByWeek({
        week: normalisedWeek,
        type: "Home",
        type_category: currentHomeCategory
      });
    } else {
      loadWorkoutsByWeek({ week: normalisedWeek });
    }
  }
  
  const updateExerciseCompletionUI = (exerciseItem, isComplete) => {
    exerciseItem.classList.toggle("is-complete", isComplete);

    const emptyIcon = exerciseItem.querySelector('[data-icon="exercise-empty"]');
    const completeIcon = exerciseItem.querySelector('[data-icon="exercise-complete"]');
    const altDropdown = exerciseItem.querySelector('[data-exercise="alt-exercise-dropdown"]');
    const arrowIcon = exerciseItem.querySelector('[data-exercise="arrow-icon"]');

    if (emptyIcon) emptyIcon.style.display = isComplete ? "none" : "flex";
    if (completeIcon) completeIcon.style.display = isComplete ? "block" : "none";

    if (altDropdown) altDropdown.style.display = isComplete ? "none" : "flex";
    if (arrowIcon) arrowIcon.style.display = isComplete ? "block" : "none";
  };
  
  function toggleButtonLoader(button, isLoading) {
    const loaderWrap = button.querySelector('.button-loader-wrap');
    if (!loaderWrap) return;

    if (isLoading) {
      button.classList.add('is-loading');
      button.style.pointerEvents = "none";
      button.style.opacity = "0.6";

      let loader = loaderWrap.querySelector('.button-loader');
      if (!loader) {
        loader = document.createElement('div');
        loader.className = 'button-loader';
        loaderWrap.appendChild(loader);
      }
    } else {
      button.classList.remove('is-loading');
      button.style.pointerEvents = "auto";
      button.style.opacity = "1";

      const loader = loaderWrap.querySelector('.button-loader');
      if (loader) loader.remove();
    }
  }
  
  function updateWeeklyProgressBar(workouts, memberJSON, trainingFrequency) {
    const completedCount = workouts.filter(w => {
      const saved = memberJSON?.data?.workouts?.[w.slug];
      return saved?.status === "complete";
    }).length;

    const percentage = Math.round((completedCount / trainingFrequency) * 100);

    if (DOM.progressBar) DOM.progressBar.style.width = `${percentage}%`;

    const isAllComplete = completedCount === trainingFrequency;

    if (DOM.progressLabel) {
      DOM.progressLabel.textContent = `${completedCount}/${trainingFrequency}`;

      const parent = DOM.progressLabel.parentElement;
      if (parent) {
        parent.classList.toggle("is-complete", isAllComplete);
      }
    }

    if (DOM.progressHeading) {
      DOM.progressHeading.textContent = isAllComplete ? "All workouts complete" : "Workouts not completed";
      DOM.progressHeading.classList.toggle("is-complete", isAllComplete);
    }

    if (DOM.completeIcon) DOM.completeIcon.style.display = isAllComplete ? "block" : "none";
    if (DOM.notCompleteIcon) DOM.notCompleteIcon.style.display = isAllComplete ? "none" : "block";

    workouts.forEach((w, i) => {
      const cardCache = DOM.getCard(i + 1);
      if (!cardCache) return;

      const saved = memberJSON?.data?.workouts?.[w.slug];
      const isComplete = saved?.status === "complete";

      if (cardCache.overlay) cardCache.overlay.classList.toggle("is-complete", isComplete);

      cardCache.showCompleteEls.forEach(el => {
        el.style.display = isComplete ? "block" : "none";
      });

      cardCache.hideCompleteEls.forEach(el => {
        el.style.display = isComplete ? "none" : "block";
      });
    });
  }
  
  function triggerToast(triggerId) {
    const toastBox = document.querySelector(`[ms-code-toast-box="${triggerId}"]`);
    if (!toastBox) return;

    const slideInDuration = 300;
    const staticDuration = 2000;
    const fadeOutDuration = 300;
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    toastBox.style.display = "flex";
    toastBox.style.opacity = "0";
    toastBox.style.transform = "translateY(-100%)";
    toastBox.style.transition = "none";

    setTimeout(() => {
      toastBox.style.transition = "transform 0.3s ease, opacity 0.3s ease";
      toastBox.style.transform = "translateY(0)";
      toastBox.style.opacity = "1";
    }, 10);

    const onTouchStart = (e) => {
      isDragging = true;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      toastBox.style.transition = "none";
    };

    const onTouchMove = (e) => {
      if (!isDragging) return;
      currentY = e.touches ? e.touches[0].clientY : e.clientY;
      const translateY = currentY - startY;
      if (translateY < 0) {
        e.preventDefault();
        toastBox.style.transform = `translateY(${translateY}px)`;
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
      const distance = startY - currentY;
      if (distance > 30) {
        toastBox.style.transition = "transform 0.3s ease, opacity 0.3s ease";
        toastBox.style.transform = "translateY(-150%)";
        toastBox.style.opacity = "0";
        setTimeout(() => {
          toastBox.style.display = "none";
        }, fadeOutDuration);
      } else {
        toastBox.style.transition = "transform 0.3s ease";
        toastBox.style.transform = "translateY(0)";
      }
    };

    toastBox.addEventListener("mousedown", onTouchStart);
    toastBox.addEventListener("mousemove", onTouchMove);
    toastBox.addEventListener("mouseup", onTouchEnd);
    toastBox.addEventListener("mouseleave", onTouchEnd);
    toastBox.addEventListener("touchstart", onTouchStart, { passive: false });
    toastBox.addEventListener("touchmove", onTouchMove, { passive: false });
    toastBox.addEventListener("touchend", onTouchEnd);

    setTimeout(() => {
      if (!isDragging) {
        toastBox.style.transition = "transform 0.3s ease, opacity 0.3s ease";
        toastBox.style.transform = "translateY(-100%)";
        toastBox.style.opacity = "0";
        setTimeout(() => {
          toastBox.style.display = "none";
        }, fadeOutDuration);
      }
    }, slideInDuration + staticDuration);
  }
  
  document.querySelectorAll('[data-load-home]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const typeCategory = btn.getAttribute("data-load-home");
      if (typeCategory) {
        currentWorkoutType = "Home";
        currentHomeCategory = typeCategory;

        loadWorkoutsByWeek({
          type: "Home",
          type_category: typeCategory
        });
      }
    });
  });
  
  document.querySelectorAll('[data-load-gym]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      currentWorkoutType = "Gym";
      currentHomeCategory = null;

      loadWorkoutsByWeek({ week: currentWeek });
    });
  });
});
