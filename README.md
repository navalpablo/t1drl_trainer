# T1-Dark Rim Lesion Training Platform

An interactive web-based training resource for standardizing identification of T1-dark rim lesions (T1-DRLs) in multiple sclerosis.

## About

T1-dark rim lesions are a recently described MRI sign for chronic active inflammation in multiple sclerosis, visible on routine 3D T1-weighted sequences ([Naval-Baudin et al., European Journal of Radiology, 2024](https://doi.org/10.1016/j.ejrad.2024.111358)).

This platform provides approximately 400 expert-labeled training cases organized into:
- **5 guided training batches** with immediate feedback
- **15 self-evaluation batches** with performance metrics

All cases were labeled through a rigorous two-stage consensus process by experienced neuroradiologists.

## Access the Platform

**Live interactive platform:** [https://navalpablo.github.io/t1drl_trainer/](https://navalpablo.github.io/t1drl_trainer/)

No installation required. Works on desktop and mobile devices.

## How to Use

1. **Start with guided training** (batches 1-5) to learn the T1-DRL criteria with labeled examples
2. **Test yourself** with self-evaluation batches (6-20) and receive immediate scoring
3. **Track your progress** with built-in analytics stored locally in your browser

## Dataset Details

- **~400 lesion cases** with expert consensus labels (true T1-DRL vs. false positive)
- **Multiple consecutive MRI slices** per lesion (median 5 slices, range 3-11)
- **Segmentation masks** for lesion localization
- **3T MRI data** from standardized protocol (Philips 3T, 1mm sagittal 3D T1-TFE)

## License

### Code
The website code (HTML, CSS, JavaScript) is licensed under the [MIT License](LICENSE).

### Data
The MRI images and consensus labels are licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

You may use, adapt, and share this dataset for any purpose, including commercial use, provided you give appropriate credit.

## Citation

If you use this training platform in your research or clinical work, please cite:

**Dataset:**
> Naval-Baudin P, Pons-Escoda A, et al. (2025). T1-Dark Rim Lesion Training Platform. 
> [Dataset DOI pending]

**Original T1-DRL paper:**
> Naval-Baudin P, Pons-Escoda A, Castillo-Pinar A, et al. (2024). The T1-dark-rim: A novel imaging sign for detecting smoldering inflammation in multiple sclerosis. European Journal of Radiology, 173, 111358. 
> https://doi.org/10.1016/j.ejrad.2024.111358

**Data descriptor paper:** *In preparation*


## Project Status

- ✅ IRB approved
- ✅ Platform publicly accessible
- 🔄 Data descriptor manuscript in preparation
- 🔄 Zenodo archival pending

